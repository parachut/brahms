import { WebClient } from '@slack/client';
import numeral from 'numeral';
import Recurly from 'recurly';
import { Op } from 'sequelize';
import { Authorized, Ctx, Mutation, Resolver } from 'type-graphql';
import pMap from 'p-map';
import Stripe from 'stripe';

import { plans } from '../decorators/plans';
import { InventoryStatus } from '../enums/inventoryStatus';
import { ShipmentDirection } from '../enums/shipmentDirection';
import { ShipmentType } from '../enums/shipmentType';
import { UserRole } from '../enums/userRole';
import { UserStatus } from '../enums/userStatus';
import { Cart } from '../models/Cart';
import { Inventory } from '../models/Inventory';
import { User } from '../models/User';
import { Shipment } from '../models/Shipment';
import { UserIntegration } from '../models/UserIntegration';
import { createQueue } from '../redis';
import { prorate, calcItemLevel } from '../utils/calc';
import { IContext } from '../utils/context.interface';
import { sendEmail } from '../utils/sendEmail';

if (!process.env.RECURLY) {
  throw new Error('Missing environment variable RECURLY');
}

if (!process.env.SLACK_TOKEN) {
  throw new Error('Missing environment variable SLACK_TOKEN');
}

const stripe = new Stripe(process.env.STRIPE);

const recurly = new Recurly.Client(process.env.RECURLY, `subdomain-parachut`);
const slack = new WebClient(process.env.SLACK_TOKEN);
const internalQueue = createQueue('internal-queue');

@Resolver(Cart)
export default class CheckoutResolver {
  @Authorized([UserRole.MEMBER])
  @Mutation(() => Cart)
  public async checkout(@Ctx() ctx: IContext) {
    if (ctx.user) {
      const user = await User.findByPk(ctx.user.id, {
        include: [
          {
            association: 'carts',
            where: { completedAt: null },
            order: [['createdAt', 'DESC']],
            include: [
              {
                association: 'items',
                include: ['product'],
              },
            ],
          },
          'integrations',
          {
            association: 'currentInventory',
            include: ['product'],
          },
        ],
      });

      const [cart] = user.carts;

      const inventory = [];
      const availableInventory = await Inventory.findAll({
        where: {
          productId: { [Op.in]: cart.items.map((item) => item.productId) },
          status: InventoryStatus.INWAREHOUSE,
        },
      });

      for (const item of cart.items) {
        const itemLevel = calcItemLevel(item.points);

        if (item.points > 5500) {
          throw new Error(
            `${item.product.name} has over 5500 points. Please contact support@parachut.co.`,
          );
        }
        if (item.points > 2500 && itemLevel !== 'level-3') {
          throw new Error(
            `${item.product.name} requires a level-3 membership.`,
          );
        }
        if (item.points > 1000 && itemLevel === 'level-1') {
          throw new Error(
            `${item.product.name} requires at least a level-2 membership.`,
          );
        }

        const itemInventory = availableInventory.filter(
          (i) => i.productId === item.productId,
        );

        if (itemInventory.length < item.quantity) {
          throw new Error(`${item.product.name} is out of stock.`);
        }

        for (let i = 0; i < item.quantity; i++) {
          inventory.push(itemInventory[i].id);
        }
      }

      if (!cart.completedAt && user.status === UserStatus.BLACKLISTED) {
        cart.completedAt = new Date();
        cart.canceledAt = new Date();
        return cart.save();
      }

      if (cart.completedAt) {
        throw new Error('Cart already complete');
      }

      const itemsCount = cart.items.reduce((r, ii) => r + ii.quantity, 0);

      const inUse = user.currentInventory.length;

      const overageItems = itemsCount + inUse > 3 ? itemsCount + inUse - 3 : 0;

      if (overageItems > user.additionalItems) {
        user.additionalItems = overageItems;
      }

      const currentBilling =
        plans[user.planId || cart.planId] + (user.protectionPlan ? 49 : 0);

      const futureBilling = plans[cart.planId] + (cart.protectionPlan ? 49 : 0);

      const recurlyId = user.integrations.find((int) => int.type === 'RECURLY');

      const recurlySubscription = user.integrations.find(
        (int) => int.type === 'RECURLY_SUBSCRIPTION',
      );

      const subscriptionReq: any = {
        planCode: cart.planId,
        addOns: [],
      };

      if (cart.protectionPlan) {
        subscriptionReq.addOns.push({
          code: 'protection',
          quantity: 1,
        });
      }

      if (user.additionalItems) {
        for (let i = 0; i < user.additionalItems; i++) {
          subscriptionReq.addOns.push({
            code: 'additional',
            quantity: 1,
            unit_amount: 99,
          });
        }
      }

      if (!subscriptionReq.addOns.length) {
        delete subscriptionReq.addOns;
      }

      let _continue = false;

      try {
        if (!recurlySubscription) {
          const purchaseReq = {
            currency: 'USD',
            account: {
              id: recurlyId.value,
            },
            subscriptions: [subscriptionReq],
            couponCodes: [],
            // lineItems: [],
          };

          if (cart.couponCode) {
            purchaseReq.couponCodes.push(cart.couponCode);
          }

          if (!purchaseReq.couponCodes.length) {
            delete purchaseReq.couponCodes;
          }

          // if (cart.service !== 'Ground') {
          //   purchaseReq.lineItems.push({
          //     type: 'charge',
          //     currency: 'USD',
          //     unitAmount: 50,
          //     quantity: 1,
          //     description: 'Expedited Shipping',
          //   });
          // }

          const stripeSub = user.integrations.find(
            (inte) => inte.type === 'STRIPE_MONTHLYPLAN',
          );

          if (stripeSub) {
            const prorated = prorate(
              futureBilling,
              currentBilling,
              user.billingDay,
            );

            subscriptionReq.trialEndsAt = prorated.nextBillingDate;

            if (prorated.amount > 0) {
              // purchaseReq.lineItems.push({
              //   type: 'charge',
              //   currency: 'USD',
              //   unitAmount: prorated.amount,
              //   quantity: 1,
              //   description: 'Prorated overage',
              // });
            }

            await stripe.subscriptions.del(stripeSub.value);
          }

          console.log(purchaseReq);

          const purchase = await recurly.createPurchase(purchaseReq);

          await UserIntegration.create({
            userId: user.id,
            type: 'RECURLY_SUBSCRIPTION',
            value: purchase.chargeInvoice.subscriptionIds[0],
          });

          await sendEmail({
            to: user.email,
            from: 'support@parachut.co',
            id: 12931487,
            data: {
              purchase_date: new Date().toDateString(),
              name: user.parsedName.first,
              chutItems: cart.items.map((item) => ({
                image: item.product.images.length
                  ? `https://parachut.imgix.net/${item.product.images[0]}`
                  : '',
                name: item.product.name,
              })),
              planId: cart.planId,
              monthly: numeral(plans[cart.planId]).format('$0,0.00'),
              protectionPlan: !!cart.protectionPlan,
              totalMonthly: numeral(plans[cart.planId]).format('$0,0.00'),
            },
          });
        } else {
          /** if (cart.service !== 'Ground') {
           
              await recurly.createPurchase({
                currency: 'USD',
                account: {
                  id: recurlyId.value,
                },
                lineItems: {
                  type: 'charge',
                  currency: 'USD',
                  quantity: 1,
                  unitAmount: 25,
                  description: 'Expedited Shipping',
                },
              });
            
          }*/

          try {
            await recurly.createSubscriptionChange(
              recurlySubscription.value,
              subscriptionReq,
            );
            _continue = true;
          } catch (e) {
            if (
              e.message ===
              'The submitted values match the current subscriptions values.'
            ) {
              _continue = true;
            } else {
              throw e;
            }
          }
        }
      } catch (e) {
        if (process.env.STAGE === 'production') {
          await slack.chat.postMessage({
            channel: 'CGX5HELCT',
            text: '',
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text:
                    '*Order billing failed:* ' +
                    user.name +
                    '\n<https://app.forestadmin.com/48314/data/2108279/index/record/2108279/' +
                    cart.id +
                    '/summary|' +
                    cart.id +
                    '>',
                },
              },
              {
                type: 'section',
                fields: [
                  {
                    type: 'mrkdwn',
                    text: '*Completed:*\n' + new Date().toLocaleString(),
                  },
                  {
                    type: 'mrkdwn',
                    text:
                      '*Protection Plan:*\n' +
                      (cart.protectionPlan ? 'YES' : 'NO'),
                  },
                  {
                    type: 'mrkdwn',
                    text: '*Service:*\n' + cart.service,
                  },
                  {
                    type: 'mrkdwn',
                    text: '*Plan:*\n' + cart.planId || user.planId,
                  },
                  {
                    type: 'mrkdwn',
                    text: '*Reason:*\n' + e.message,
                  },
                ],
              },
            ],
          });
        }

        console.log(e);

        throw new Error(e.message);
      }

      await Inventory.update(
        {
          status: 'SHIPMENTPREP',
          memberId: user.id,
        },
        {
          where: {
            id: {
              [Op.in]: inventory,
            },
          },
        },
      );

      if (process.env.STAGE === 'production') {
        try {
          await pMap(['CGX5HELCT', 'CA8M5UG1K'], (c) =>
            slack.chat.postMessage({
              channel: c,
              text: '',
              blocks: [
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text:
                      '*New order for:* ' +
                      user.name +
                      '\n<https://app.forestadmin.com/48314/data/2108279/index/record/2108279/' +
                      cart.id +
                      '/summary|' +
                      cart.id +
                      '>',
                  },
                },
                {
                  type: 'section',
                  fields: [
                    {
                      type: 'mrkdwn',
                      text: '*Completed:*\n' + new Date().toLocaleString(),
                    },
                    {
                      type: 'mrkdwn',
                      text:
                        '*Protection Plan:*\n' +
                        (cart.protectionPlan ? 'YES' : 'NO'),
                    },
                    {
                      type: 'mrkdwn',
                      text: '*Service:*\n' + cart.service,
                    },
                    {
                      type: 'mrkdwn',
                      text: '*Plan:*\n' + cart.planId || user.planId,
                    },
                  ],
                },
              ],
            }),
          );
        } catch (e) {}
      }

      if (_continue) {
        cart.confirmedAt = new Date();

        const shipment = await Shipment.create({
          direction: ShipmentDirection.OUTBOUND,
          expedited: cart.service !== 'Ground',
          type: ShipmentType.ACCESS,
          service: cart.service,
          cartId: cart.id,
        });

        await shipment.$set('inventory', inventory);

        await sendEmail({
          to: user.email,
          from: 'support@parachut.co',
          id: 12932745,
          data: {
            purchase_date: new Date().toDateString(),
            name: user.name,
            chutItems: cart.items.map((item) => ({
              image: item.product.images.length
                ? `https://parachut.imgix.net/${item.product.images[0]}`
                : '',
              name: item.product.name,
            })),
          },
        });
      }

      user.planId = cart.planId;
      user.billingDay = user.billingDay || new Date().getDate();
      user.protectionPlan = cart.protectionPlan;

      await user.save();

      cart.completedAt = new Date();
      await cart.$set('inventory', inventory);
      await cart.save();

      ctx.analytics.track({
        event: 'Order Completed',
        properties: {
          checkout_id: cart.id,
          currency: 'USD',
          order_id: cart.id,
          products: cart.items.map((item) => ({
            image_url: item.product.images
              ? `https://parachut.imgix.net/${item.product.images[0]}`
              : undefined,
            name: item.product.name,
            price: item.product.points,
            product_id: item.product.id,
            quantity: item.quantity,
          })),
          shipping: cart.service !== 'Ground' ? 25 : 0,
        },
        userId: ctx.user.id,
      });

      for (const item of cart.items) {
        internalQueue.add('update-product-stock', {
          productId: item.productId,
        });
      }

      return cart;
    }

    throw new Error('Unauthorised');
  }
}
