import { WebClient } from '@slack/client';
import numeral from 'numeral';
import Recurly from 'recurly';
import { Op } from 'sequelize';
import { Authorized, Ctx, Mutation, Query, Resolver } from 'type-graphql';
import pMap from 'p-map';

import { plans, planName } from '../decorators/plans';
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
import { calcItemLevel } from '../utils/calc';
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

@Resolver(Cart)
export default class CheckoutResolver {
  @Authorized([UserRole.MEMBER])
  @Mutation(() => Cart)
  public async checkout(@Ctx() ctx: IContext) {
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

    const completedCart = await Cart.findOne({
      where: {
        completedAt: { [Op.ne]: null },
        userId: ctx.user.id,
      },
    });

    const [cart] = user.carts;

    if (!cart.completedAt && user.status === UserStatus.BLACKLISTED) {
      cart.completedAt = new Date();
      cart.canceledAt = new Date();
      return cart.save();
    }

    const inventory = [];
    const availableInventory = await Inventory.findAll({
      where: {
        productId: { [Op.in]: cart.items.map((item) => item.productId) },
        status: InventoryStatus.INWAREHOUSE,
      },
    });

    for (const item of cart.items) {
      if (item.points > 2500 && cart.planId !== 'level-3') {
        throw new Error(`${item.product.name} requires a level-3 membership.`);
      }
      if (item.points > 1000 && cart.planId === 'level-1') {
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

    if (cart.completedAt) {
      throw new Error('Cart already complete');
    }

    const itemsCount = cart.items.reduce((r, ii) => r + ii.quantity, 0);

    const inUse = user.currentInventory.length;

    const overageItems = itemsCount + inUse > 3 ? itemsCount + inUse - 3 : 0;

    if (overageItems > user.additionalItems) {
      user.additionalItems = overageItems;
    }

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
      subscriptionReq.addOns.push({
        code: 'additional',
        quantity: user.additionalItems,
      });
    }

    if (!subscriptionReq.addOns.length) {
      delete subscriptionReq.addOns;
    }

    let _continue = false;
    let subscriptionRes = null;

    try {
      if (!recurlySubscription) {
        const purchaseReq = {
          currency: 'USD',
          account: {
            id: recurlyId.value,
          },
          subscriptions: [subscriptionReq],
          couponCodes: [],
          lineItems: [],
        };

        if (cart.couponCode) {
          purchaseReq.couponCodes.push(cart.couponCode);
        }

        if (!purchaseReq.couponCodes.length) {
          delete purchaseReq.couponCodes;
        }

        if (cart.service !== 'Ground') {
          purchaseReq.lineItems = [
            {
              type: 'charge',
              currency: 'USD',
              unitAmount: 50,
              quantity: 1,
              description: 'Expedited Shipping',
            },
          ];
        } else {
          delete purchaseReq.lineItems;
        }

        const purchase = await recurly.createPurchase(purchaseReq);

        await UserIntegration.create({
          userId: user.id,
          type: 'RECURLY_SUBSCRIPTION',
          value: purchase.chargeInvoice.subscriptionIds[0],
        });
      } else {
        if (cart.service !== 'Ground') {
          await recurly.createPurchase({
            currency: 'USD',
            account: {
              id: recurlyId.value,
            },
            lineItems: [
              {
                type: 'charge',
                currency: 'USD',
                quantity: 1,
                unitAmount: 50,
                description: 'Expedited Shipping',
              },
            ],
          });
        }

        if (!user.legacyPlan) {
          try {
            subscriptionRes = await recurly.createSubscriptionChange(
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
        } else {
          _continue = true;
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
        individualHooks: true,
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
    }

    await sendEmail({
      to: user.email,
      from: 'support@parachut.co',
      id: !completedCart ? 12931487 : 12932745,
      data: {
        purchase_date: new Date().toDateString(),
        name: user.parsedName.first,
        cartItems: cart.items.map((item) => ({
          image: item.product.images.length
            ? `https://parachut.imgix.net/${item.product.images[0]}`
            : '',
          name: item.product.name,
        })),
        extraSpots: {
          additionalItems: user.additionalItems,
          additionalCost: user.additionalItems * 99,
        },
        planId: planName[cart.planId],
        spotsUsed: user.additionalItems + 3,
        monthly: numeral(plans[cart.planId]).format('$0,0.00'),
        protectionPlan: cart.protectionPlan,
      },
    });

    user.planId = cart.planId;
    user.billingDay = user.billingDay || new Date().getDate();
    user.protectionPlan = cart.protectionPlan;
    user.points = cart.items.reduce((r, i) => r + i.points, 0);

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

    return cart;
  }
}
