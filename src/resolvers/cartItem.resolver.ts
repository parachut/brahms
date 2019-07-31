import {
  Arg,
  Authorized,
  Ctx,
  ID,
  FieldResolver,
  Mutation,
  Query,
  Resolver,
  Root,
} from 'type-graphql';

import { CartItemCreateInput } from '../classes/cartItemCreate.input';
import { CartItemUpdateInput } from '../classes/cartItemUpdate.input';
import { CartUpdateInput } from '../classes/cartUpdate.input';
import { CartWhereUniqueInput } from '../classes/CartWhereUnique.input';
import { CartItemWhereUniqueInput } from '../classes/cartItemWhereUnique.input';
import { UserRole } from '../enums/userRole';
import { Cart } from '../models/Cart';
import { CartItem } from '../models/CartItem';
import { Product } from '../models/Product';
import { IContext } from '../utils/context.interface';

@Resolver(Cart)
export default class CartItemResolver {
  @Authorized([UserRole.MEMBER])
  @Mutation(() => CartItem)
  public async cartItemCreate(
    @Arg('input', (type) => CartItemCreateInput)
    { productId, quantity }: CartItemCreateInput,
    @Ctx() ctx: IContext,
  ) {
    if (ctx.user) {
      const cart = await Cart.findOne({
        where: { userId: ctx.user.id, completedAt: null },
        attributes: ['id'],
      });

      if (!cart) {
        throw new Error('Cart mismatch');
      }

      return CartItem.create({
        productId,
        quantity,
      });
    }

    throw new Error('Unauthorized');
  }

  @Authorized([UserRole.MEMBER])
  @Mutation(() => CartItem)
  public async cartItemupdate(
    @Arg('where', (type) => CartItemWhereUniqueInput)
    { id }: CartItemWhereUniqueInput,
    @Arg('input', (type) => CartItemUpdateInput)
    { quantity }: CartItemUpdateInput,
    @Ctx() ctx: IContext,
  ) {
    if (ctx.user) {
      return CartItem.update(
        {
          quantity,
        },
        {
          where: {
            id,
            userId: ctx.user.id,
          },
        },
      );
    }

    throw new Error('Unauthorized');
  }

  @Authorized([UserRole.MEMBER])
  @Mutation(() => CartItem)
  public async cartItemDestroy(
    @Arg('where', (type) => CartItemWhereUniqueInput)
    { id }: CartItemWhereUniqueInput,
    @Ctx() ctx: IContext,
  ) {
    if (ctx.user) {
      const cartItem = await CartItem.findOne({
        where: {
          id,
          userId: ctx.user.id,
        },
      });

      if (!cartItem) {
        throw new Error('Cart item not found.');
      }

      await CartItem.destroy({
        where: {
          id,
          userId: ctx.user.id,
        },
      });

      return cartItem;
    }

    throw new Error('Unauthorized');
  }

  @FieldResolver((type) => Product)
  async product(@Root() cartItem: CartItem): Promise<Product> {
    return ((await cartItem.$get<Product>('product')) as Product)!;
  }
}
