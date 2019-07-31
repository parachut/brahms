import EasyPost from '@easypost/api';

import { WebClient } from '@slack/client';
import * as Postmark from 'postmark';
import { Op } from 'sequelize';
import Stripe from 'stripe';
import {
  Arg,
  Authorized,
  Ctx,
  FieldResolver,
  Mutation,
  Query,
  Resolver,
  Root,
} from 'type-graphql';

import { CartTransitTime } from '../classes/cartTransitTime';
import { CartUpdateInput } from '../classes/cartUpdate.input';
import { InventoryStatus } from '../enums/inventoryStatus';
import { UserRole } from '../enums/userRole';
import { UserStatus } from '../enums/userStatus';
import { Address } from '../models/Address';
import { Cart } from '../models/Cart';
import { CartItem } from '../models/CartItem';
import { Inventory } from '../models/Inventory';
import { User } from '../models/User';
import { Warehouse } from '../models/Warehouse';
import { calcDailyRate, calcProtectionDailyRate } from '../utils/calc';
import { IContext } from '../utils/context.interface';

const numeral = require('numeral');
const moment = require('moment-business-days');
const stripe = new Stripe(process.env.STRIPE);
const slack = new WebClient(process.env.SLACK_TOKEN);
const postmark = new Postmark.ServerClient(process.env.POSTMARK);
const easyPost = new EasyPost(process.env.EASYPOST);

@Resolver(Cart)
export default class CartResolver {
  @Authorized([UserRole.MEMBER])
  @Query((returns) => Cart)
  public async cart(@Ctx() ctx: IContext) {
    if (ctx.user) {
      let cart = await Cart.findOne({
        where: {
          user: ctx.user.id,
          completedAt: null,
        },
      });

      if (!cart) {
        cart = new Cart({
          userId: ctx.user.id,
        });

        await cart.save();
      }

      return cart;
    }

    throw new Error('Unathorised.');
  }

  @Authorized([UserRole.MEMBER])
  @Query((returns) => [Cart])
  public async carts(@Ctx() ctx: IContext) {
    if (ctx.user) {
      const carts = await Cart.findAll({
        where: { userId: ctx.user.id },
      });

      return carts;
    }
    throw new Error('Unathorised.');
  }

  @Authorized([UserRole.MEMBER])
  @Mutation(() => CartItem)
  public async cartUpdate(
    @Arg('input', (type) => CartUpdateInput)
    { service, planId, protectionPlan }: CartUpdateInput,
    @Ctx() ctx: IContext,
  ) {
    if (ctx.user) {
      const cart = await Cart.findOne({
        where: { userId: ctx.user.id, completedAt: null },
        attributes: ['id'],
      });

      return CartItem.update(
        {
          protectionPlan,
          planId,
          service,
        },
        {
          where: {
            id: cart.id,
          },
        },
      );
    }

    throw new Error('Unauthorized');
  }

  @Authorized([UserRole.MEMBER])
  @Mutation(() => Cart)
  public async checkout(@Ctx() ctx: IContext) {
    if (ctx.user) {
      const user = await User.findByPk(ctx.user.id, {
        include: [
          {
            association: 'carts',
            where: { completedAt: null, user: ctx.user.id },
            include: [
              {
                association: 'items',
                include: ['product'],
              },
            ],
          },
          {
            association: 'currentInventory',
            where: {
              member: ctx.user.id,
              status: {
                [Op.in]: [
                  InventoryStatus.WITHMEMBER,
                  InventoryStatus.RETURNING,
                ],
              },
            },
            include: ['product'],
          },
          {
            association: 'integrations',
          },
        ],
      });
      let charge;
      let total;
      let cartUpdate: any = {};

      const cart = user.carts[0];

      if (!cart.completedAt && user.status === UserStatus.BLACKLISTED) {
        cart.completedAt = new Date();
        cart.canceledAt = new Date();
        return cart.save();
      }

      if (!cart.completedAt) {
        const inventory = [];
        for (const item of cart.items) {
          const availableInventory = await item.product.$get('inventory', {
            where: {
              status: InventoryStatus.INWAREHOUSE,
            },
          });

          for (let i = 0; i < item.quantity; i++) {
            if (availableInventory[i]) {
              inventory.push(availableInventory[i]);
            }
          }
        }

        const cartPoints = user.carts[0].items.reduce(
          (r, ii) => r + ii.product.points * ii.quantity,
          0,
        );

        const currentPoints = user.currentInventory.reduce(
          (r, ii) => r + ii.product.points * 1,
          0,
        );

        if (cart.planId || user.planId) {
          // await updateSubscription(data.plan);
        } else {
          total = 3 * calcDailyRate(cartPoints);

          if (cart.protectionPlan) {
            total += 3 * calcProtectionDailyRate(cartPoints);
          }

          try {
            await stripe.invoiceItems.create({
              amount: total * 100,
              currency: 'usd',
              customer: user.stripeId,
              description: 'Deposit',
            });

            cartUpdate.confirmedAt = new Date();
          } catch (e) {
            charge = {
              id: e.charge,
            };
          }
        }

        if (cart.service !== 'Ground') {
          await stripe.invoiceItems.create({
            amount: 2500,
            currency: 'usd',
            customer: user.stripeId,
            description: 'Expedited Shipping',
          });
        }

        try {
          let invoice = await stripe.invoices.create({
            customer: user.stripeId,
            auto_advance: true,
            billing: 'charge_automatically',
          });

          invoice = await stripe.invoices.pay(invoice.id);

          if (!cart.planId && !user.planId && invoice.paid) {
            const stripeCustomerRef: Stripe.customers.ICustomer = await stripe.customers.retrieve(
              user.stripeId,
            );

            await stripe.customers.update(user.stripeId, {
              account_balance: stripeCustomerRef.account_balance - total * 100,
            });
          }

          cartUpdate.chargeId = invoice.charge;
        } catch (e) {
          throw e;
        }

        if (process.env.STAGE === 'production') {
          try {
            const totalDailyRate = calcDailyRate(cartPoints);

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
                      text:
                        '*Total Points:*\n' + numeral(cartPoints).format('0,0'),
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
                    cart.planId || user.planId
                      ? {
                          type: 'mrkdwn',
                          text: '*Unlimited User:*\n' + cart.planId,
                        }
                      : {
                          type: 'mrkdwn',
                          text:
                            '*Daily Rate:*\n' +
                            numeral(
                              calcDailyRate(cartPoints) +
                                (cart.protectionPlan
                                  ? calcProtectionDailyRate(totalDailyRate)
                                  : 0),
                            ).format('$0,0'),
                        },
                  ],
                },
              ],
            });

            postmark.sendEmailWithTemplate({
              From: 'support@parachut.co',
              TemplateId: 10952889,
              TemplateModel: {
                chutItems: cart.items.map((item: any) => ({
                  dailyRate: calcDailyRate(item.product.points),
                  image:
                    item.product.images && item.product.images.length
                      ? `https://parachut.imgix.net/${item.product.images[0].filename}`
                      : null,
                  name: item.product.name,
                  quantity: item.quantity,
                })),
                dailyRate: totalDailyRate,
                name: user.name.split(' ')[0],
                protectionPlan: cart.protectionPlan
                  ? {
                      protectionDaily: calcProtectionDailyRate(totalDailyRate),
                    }
                  : false,
                purchase_date: new Date().toDateString(),
                total,
                totalRate:
                  totalDailyRate +
                  (cart.protectionPlan
                    ? calcProtectionDailyRate(totalDailyRate)
                    : 0),
              },
              To: user.email,
            });
          } catch (e) {
            console.log(e);
          }
        }

        await Inventory.update(
          {
            status: 'SHIPMENTPREP',
            member: user.id,
          },
          {
            where: {
              id: {
                [Op.in]: inventory.map((x) => x.id),
              },
            },
          },
        );

        await Cart.update(
          {
            chargeId: charge ? charge.id : null,
            inventory: inventory,
            completedAt: new Date(),
            ...cartUpdate,
          },
          {
            where: {
              id: cart.id,
            },
          },
        );

        const newCart = new Cart({
          userId: user.id,
        });

        return newCart.save();
      }

      throw new Error('Unauthorized');
    }
  }

  @FieldResolver((type) => [CartItem])
  async items(@Root() cart: Cart): Promise<CartItem[]> {
    return ((await cart.$get<CartItem>('items')) as CartItem[])!;
  }

  @FieldResolver((type) => [CartItem])
  async inventory(@Root() cart: Cart): Promise<Inventory[]> {
    return ((await cart.$get<Inventory>('inventory')) as Inventory[])!;
  }

  @FieldResolver((type) => [CartItem])
  async address(@Root() cart: Cart): Promise<Address> {
    return ((await cart.$get<Address>('address')) as Address)!;
  }

  @FieldResolver((type) => CartTransitTime, { nullable: true })
  async transitTimes(
    @Root() cart: Cart,
    @Ctx() ctx: IContext,
  ): Promise<CartTransitTime[]> | null {
    if (!cart.addressId) {
      return null;
    }

    let transitTimes: any = await ctx.redis.get(
      `${cart.addressId}:TRANSITTIMES`,
    );

    if (transitTimes) {
      return JSON.parse(transitTimes);
    }

    const [address, warehouse] = await Promise.all([
      Address.findByPk(cart.addressId, { attributes: ['easyPostId'] }),
      Warehouse.findOne({
        where: {},
        attributes: ['easyPostId'],
      }),
    ]);

    if (!address || !warehouse) {
      return null;
    }

    const parcel = new easyPost.Parcel({
      height: 14,
      length: 14,
      weight: 1,
      width: 14,
    });

    const easyPostShipment = new easyPost.Shipment({
      carrier_account: process.env.EASYPOST_CARRIER_ACCOUNT,
      from_address: warehouse.easyPostId,
      parcel,
      to_address: address.easyPostId,
    });

    try {
      await easyPostShipment.save();
    } catch (e) {
      return null;
    }

    const ground = easyPostShipment.rates.find(
      (x: any) => x.service === 'Ground',
    );
    const expedited = easyPostShipment.rates.find(
      (x: any) => x.service === '2ndDayAir',
    );

    const actualGroundDate = moment(ground.delivery_date).nextBusinessDay()._d;
    let expeditedDate =
      expedited && !!expedited.delivery_date
        ? expedited.delivery_date
        : actualGroundDate;

    if (!moment(expeditedDate).isBusinessDay()) {
      expeditedDate = moment(expeditedDate).nextBusinessDay()._d;
    }

    transitTimes = [
      {
        arrival: actualGroundDate,
        service: 'Ground',
      },
      {
        arrival: expeditedDate,
        service: '2ndDayAir',
      },
    ];

    ctx.redis.set(
      `${cart.addressId}:TRANSITTIMES`,
      JSON.stringify(transitTimes),
    );

    return transitTimes;
  }
}
