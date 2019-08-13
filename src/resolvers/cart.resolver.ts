import EasyPost from '@easypost/api';
import { WebClient } from '@slack/client';
import Analytics from 'analytics-node';
import isUndefined from 'lodash/isUndefined';
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
import { Shipment } from '../models/Shipment';
import { User } from '../models/User';
import { Warehouse } from '../models/Warehouse';
import { calcDailyRate, calcProtectionDailyRate } from '../utils/calc';
import { IContext } from '../utils/context.interface';
import { updateSubscription } from '../utils/updateSubscription';

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
          userId: ctx.user.id,
          completedAt: null,
        },
      });

      const user = await User.findByPk(ctx.user.id, { attributes: ['planId'] });

      if (!cart) {
        cart = new Cart({
          planId: !!user.planId ? user.planId : '1500',
          userId: ctx.user.id,
        });

        await cart.save();
      }

      return cart;
    }

    throw new Error('Unauthorised.');
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
    throw new Error('Unauthorised.');
  }

  @Authorized([UserRole.MEMBER])
  @Mutation(() => Cart)
  public async cartUpdate(
    @Arg('input', (type) => CartUpdateInput)
    { addressId, service, planId, protectionPlan }: CartUpdateInput,
    @Ctx() ctx: IContext,
  ) {
    if (ctx.user) {
      const cart = await Cart.findOne({
        where: { userId: ctx.user.id, completedAt: null },
      });

      const event: any = {
        event: 'Checkout Step Completed',
        properties: {
          checkout_id: cart.id,
          shipping_method: 'UPS',
          step: 0,
        },
        userId: ctx.user.id,
      };

      if (!isUndefined(service)) {
        cart.service = service;
        event.properties.step = 1;
        event.properties.shipping_service = service;
      }

      if (!isUndefined(planId)) {
        cart.planId = planId;
        event.properties.step = 0;
        event.properties.plan = planId;
      }

      if (!isUndefined(protectionPlan)) {
        cart.protectionPlan = protectionPlan;
        event.properties.step = 0;
        event.properties.protection_plan = protectionPlan;
      }

      if (!isUndefined(addressId)) {
        cart.addressId = addressId;
        event.properties.step = 1;
      }

      ctx.analytics.track(event);
      return cart.save();
    }

    throw new Error('Unauthorized');
  }

  @Authorized([UserRole.MEMBER])
  @Mutation(() => Cart)
  public async checkout(@Ctx() ctx: IContext) {
    if (ctx.user) {
      const [user, currentInventory] = await Promise.all([
        User.findByPk(ctx.user.id, {
          include: [
            {
              association: 'carts',
              where: { completedAt: null, userId: ctx.user.id },
              limit: 1,
              order: [['createdAt', 'DESC']],
              include: [
                {
                  association: 'items',
                  include: [
                    {
                      association: 'product',
                      attributes: ['id', 'points', 'name', 'images'],
                      include: [
                        {
                          association: 'inventory',
                          attributes: ['id'],
                          where: {
                            status: InventoryStatus.INWAREHOUSE,
                          },
                        },
                        {
                          association: 'brand',
                          attributes: ['name'],
                        },
                        {
                          association: 'category',
                          attributes: ['name'],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
            {
              association: 'integrations',
            },
          ],
        }),
        Inventory.findAll({
          where: {
            memberId: ctx.user.id,
            status: {
              [Op.in]: [
                InventoryStatus.SHIPMENTPREP,
                InventoryStatus.ENROUTEMEMBER,
                InventoryStatus.WITHMEMBER,
                InventoryStatus.RETURNING,
              ],
            },
          },
          include: [
            {
              association: 'product',
              attributes: ['id', 'points'],
            },
          ],
        }),
      ]);

      let charge;
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
          for (let i = 0; i < item.quantity; i++) {
            if (item.product.inventory[i]) {
              inventory.push(item.product.inventory[i].id);
            }
          }
        }

        const cartPoints = user.carts[0].items.reduce(
          (r, ii) => r + ii.product.points * ii.quantity,
          0,
        );

        const total = [...cart.items, ...currentInventory].reduce(
          (r, i) =>
            r + i.product.points * (i instanceof CartItem ? i.quantity : 1),
          0,
        );

        await updateSubscription(
          cart.planId || user.planId,
          user,
          currentInventory,
        );

        if (cart.service !== 'Ground') {
          await stripe.invoiceItems.create({
            amount: 2500,
            currency: 'usd',
            customer: user.stripeId,
            description: 'Expedited Shipping',
          });

          try {
            let invoice = await stripe.invoices.create({
              customer: user.stripeId,
              auto_advance: true,
              billing: 'charge_automatically',
            });

            invoice = await stripe.invoices.pay(invoice.id);

            cartUpdate.chargeId = invoice.charge;
          } catch (e) {
            throw e;
          }
        }

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
                  {
                    type: 'mrkdwn',
                    text: '*Plan:*\n' + cart.planId || user.planId,
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
                points: item.product.points,
                image:
                  item.product.images && item.product.images.length
                    ? `https://parachut.imgix.net/${item.product.images[0]}`
                    : null,
                name: item.product.name,
                quantity: item.quantity,
              })),
              name: user.name.split(' ')[0],
              protectionPlan: !!cart.protectionPlan,
              purchase_date: new Date().toDateString(),
              total,
            },
            To: user.email,
          });
        }

        await Inventory.update(
          {
            status: 'SHIPMENTPREP',
            memberId: user.id,
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

        ctx.analytics.track({
          event: 'Order Completed',
          properties: {
            checkout_id: cart.id,
            currency: 'USD',
            order_id: cart.id,
            products: cart.items.map((item) => ({
              brand: item.product.brand.name,
              category: item.product.category.name,
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

  @FieldResolver((type) => Address, { nullable: true })
  async address(@Root() cart: Cart): Promise<Address> {
    return (await cart.$get<Address>('address')) as Address;
  }

  @FieldResolver((type) => [Shipment], { nullable: true })
  async shipments(@Root() cart: Cart): Promise<Shipment[]> {
    return (await cart.$get<Shipment>('shipments')) as Shipment[];
  }

  @FieldResolver((type) => [CartTransitTime], { nullable: true })
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
      const parsedTimes = JSON.parse(transitTimes);
      return parsedTimes.map((t) => ({
        ...t,
        arrival: new Date(t.arrival),
      }));
    }

    const [address, warehouse] = await Promise.all([
      Address.findByPk(cart.addressId, { attributes: ['easyPostId'] }),
      Warehouse.findOne({
        where: {},
        attributes: ['easyPostId'],
      }),
    ]);

    if (
      !address ||
      !warehouse ||
      !address.easyPostId ||
      !warehouse.easyPostId
    ) {
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
        arrival: new Date(actualGroundDate),
        service: 'Ground',
      },
      {
        arrival: new Date(expeditedDate),
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
