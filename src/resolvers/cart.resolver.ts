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
import { IContext } from '../utils/context.interface';

@Resolver(Cart)
export default class CartResolver {
  @Authorized([UserRole.MEMBER])
  @Query((returns) => Cart)
  public async cart(@Ctx() ctx: IContext) {
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
      order: [['createdAt', 'DESC']],
    });

    if (!cart) {
      const user = await User.findByPk(ctx.user.id, {
        attributes: ['planId', 'protectionPlan'],
        include: ['addresses', 'integrations'],
      });

      const address = user.addresses.length
        ? user.addresses.find((address) => address.primary) || user.addresses[0]
        : null;

      cart = new Cart({
        planId: !!user.planId ? user.planId : 'level-1',
        addressId: address ? address.id : null,
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

  @Authorized([UserRole.MEMBER])
  @Query((returns) => [Cart])
  public async carts(@Ctx() ctx: IContext) {
    return Cart.findAll({
      where: {
        userId: ctx.user.id,
        canceledAt: null,
        completedAt: { [Op.ne]: null },
      },
      order: [['createdAt', 'DESC']],
    });
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
          individualHooks: true,
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
    input: CartUpdateInput,
    @Ctx() ctx: IContext,
  ) {
    if (ctx.user) {
      const cart = await Cart.findOne({
        where: { userId: ctx.user.id, completedAt: null },
        order: [['createdAt', 'DESC']],
      });

      Object.assign(cart, input);

      return cart.save();
    }

    throw new Error('Unauthorized');
  }

  @FieldResolver((type) => [CartItem])
  async items(@Root() cart: Cart): Promise<CartItem[]> {
    return cart.$get<CartItem>('items') as Promise<CartItem[]>;
  }

  @FieldResolver((type) => [Inventory])
  async inventory(@Root() cart: Cart): Promise<Inventory[]> {
    return cart.$get<Inventory>('inventory') as Promise<Inventory[]>;
  }

  @FieldResolver((type) => Address, { nullable: true })
  async address(@Root() cart: Cart): Promise<Address> {
    return cart.$get<Address>('address') as Promise<Address>;
  }

  @FieldResolver((type) => [Shipment], { nullable: true })
  async shipments(@Root() cart: Cart): Promise<Shipment[]> {
    return cart.$get<Shipment>('shipments') as Promise<Shipment[]>;
  }
}
