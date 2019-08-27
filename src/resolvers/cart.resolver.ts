import EasyPost from '@easypost/api';
import isUndefined from 'lodash/isUndefined';
import { Op } from 'sequelize';
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
import { CartWhereUniqueInput } from '../classes/cartWhereUnique.input';
import { InventoryStatus } from '../enums/inventoryStatus';
import { UserRole } from '../enums/userRole';
import { Address } from '../models/Address';
import { Cart } from '../models/Cart';
import { CartItem } from '../models/CartItem';
import { Inventory } from '../models/Inventory';
import { Shipment } from '../models/Shipment';
import { User } from '../models/User';
import { Warehouse } from '../models/Warehouse';
import { IContext } from '../utils/context.interface';

const moment = require('moment-business-days');
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
        include: [
          {
            association: 'items',
            include: ['product'],
          },
        ],
      });

      if (!cart) {
        const user = await User.findByPk(ctx.user.id, {
          attributes: ['planId'],
          include: ['addresses', 'integrations'],
        });

        const addressId = user.addresses.length
          ? user.addresses.find((address) => address.primary).id ||
            user.addresses[0].id
          : null;

        cart = new Cart({
          planId: !!user.planId ? user.planId : '1500',
          addressId,
          protectionPlan: user.protectionPlan,
          userId: ctx.user.id,
        });

        return cart.save();
      }

      if (cart.items.length) {
        for (const item of cart.items) {
          if (item.product.stock < item.quantity && item.product.stock !== 0) {
            item.quantity = item.product.stock;
            await item.save();
          }

          if (item.product.stock === 0) {
            await item.destroy();
          }
        }
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
        where: {
          userId: ctx.user.id,
          canceledAt: null,
          completedAt: { [Op.ne]: null },
        },
      });

      return carts;
    }
    throw new Error('Unauthorised.');
  }

  @Authorized([UserRole.MEMBER])
  @Mutation(() => Cart)
  public async cancelCart(
    @Arg('where', (type) => CartWhereUniqueInput)
    { id }: CartWhereUniqueInput,
    @Ctx() ctx: IContext,
  ) {
    if (ctx.user) {
      const cart = await Cart.findOne({
        where: { userId: ctx.user.id, id },
        include: ['inventory'],
      });

      await Inventory.update(
        {
          memberId: null,
          status: InventoryStatus.INWAREHOUSE,
        },
        {
          where: {
            id: { [Op.in]: cart.inventory.map((i) => i.id) },
          },
        },
      );

      cart.canceledAt = new Date();

      return cart.save();
    }

    throw new Error('Unauthorized');
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
