import { WebClient } from '@slack/client';
import numeral from 'numeral';
import Recurly from 'recurly';
import { Op } from 'sequelize';
import { Authorized, Ctx, Mutation, Resolver } from 'type-graphql';

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
import { IContext } from '../utils/context.interface';
import { sendEmail } from '../utils/sendEmail';

if (!process.env.RECURLY) {
  throw new Error('Missing environment variable RECURLY');
}

if (!process.env.SLACK_TOKEN) {
  throw new Error('Missing environment variable SLACK_TOKEN');
}

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
            limit: 1,
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
        const itemInventory = availableInventory.filter(
          (i) => i.productId === item.productId,
        );

        if (itemInventory.length < item.quantity) {
          throw new Error(`${item.product.name} is out of stock.`);
        }

        for (let i = 0; i < item.quantity; i++) {
          if ([i]) {
            inventory.push(itemInventory[i].id);
          }
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

      const inUse = user.currentInventory.reduce(
        (r, i) => r + i.product.points,
        0,
      );

      const cartPoints = cart.items.reduce(
        (r, ii) => r + ii.product.points * ii.quantity,
        0,
      );

      const total = inUse + cartPoints;

      const recurlyId = user.integrations.find((int) => int.type === 'RECURLY');

      const recurlySubscription = user.integrations.find(
        (int) => int.type === 'RECURLY_SUBSCRIPTION',
      );

      const overage = Math.max(0, total - Number(cart.planId));

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

      if (overage) {
        subscriptionReq.addOns.push({
          code: 'overage',
          quantity: Math.max(0, total - Number(cart.planId)),
        });
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
            lineItems: [],
          };

          if (cart.service !== 'Ground') {
            purchaseReq.lineItems.push({
              type: 'charge',
              currency: 'USD',
              unitAmount: 25,
              quantity: 1,
              description: 'Expedited Shipping',
            });
          }

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
                points: item.product.points,
              })),
              planId: numeral(cart.planId).format('0,0'),
              monthly: numeral(plans[cart.planId]).format('$0,0.00'),
              pointsOver: numeral(
                Math.max(0, total - Number(cart.planId)),
              ).format('0,0'),
              overage: numeral(
                Math.max(0, total - Number(cart.planId)) * 0.1,
              ).format('$0,0.00'),
              protectionPlan: !!cart.protectionPlan,
              totalMonthly: numeral(
                plans[cart.planId] +
                  Math.max(0, total - Number(cart.planId)) * 0.1 +
                  (cart.protectionPlan ? 50 : 0),
              ).format('$0,0.00'),
              availablePoints: numeral(user.points - total).format('0,0'),
              cartPoints: numeral(
                cart.items.reduce((r, i) => r + i.points, 0),
              ).format('0,0'),
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
        throw e;
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

      if (_continue) {
        cart.confirmedAt = new Date();

        const shipment = await Shipment.create({
          direction: ShipmentDirection.OUTBOUND,
          type: ShipmentType.ACCESS,
          service: '2ndDayAir',
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
            availablePoints: user.points - total,
            cartPoints: cart.items.reduce((r, i) => r + i.points, 0),
          },
        });
      }

      user.planId = cart.planId;
      user.points = total > (user.points || 0) ? total : user.points;
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
          total: cartPoints,
        },
        userId: ctx.user.id,
      });

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
                  '*New order for:* ' +
                  user.name +
                  '\n<https://team.parachut.co/ops/order/' +
                  cart.id +
                  '|' +
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
                  text: '*Total Points:*\n' + total,
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
        });
      }

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