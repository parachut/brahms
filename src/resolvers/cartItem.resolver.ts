import {
  Arg,
  Authorized,
  Ctx,
  FieldResolver,
  Mutation,
  Resolver,
  Root,
} from 'type-graphql';

import { CartItemCreateInput } from '../classes/cartItemCreate.input';
import { CartItemUpdateInput } from '../classes/cartItemUpdate.input';
import { CartItemWhereUniqueInput } from '../classes/cartItemWhereUnique.input';
import { UserRole } from '../enums/userRole';
import { Cart } from '../models/Cart';
import { CartItem } from '../models/CartItem';
import { Product } from '../models/Product';
import { IContext } from '../utils/context.interface';

@Resolver(CartItem)
export default class CartItemResolver {
  @Authorized([UserRole.MEMBER])
  @Mutation(() => CartItem)
  public async cartItemCreate(
    @Arg('input', (type) => CartItemCreateInput)
    { productId, quantity }: CartItemCreateInput,
    @Ctx() ctx: IContext,
  ) {
    const cart = await Cart.findOne({
      where: { userId: ctx.user?.id, completedAt: null },
      attributes: ['id'],
    });

    if (!cart) {
      throw new Error('Cart mismatch');
    }

    return CartItem.create({
      productId,
      quantity,
      userId: ctx.user.id,
      cartId: cart.id,
    });
  }

  @Authorized([UserRole.MEMBER])
  @Mutation(() => CartItem)
  public async cartItemUpdate(
    @Arg('where', (type) => CartItemWhereUniqueInput)
    { id }: CartItemWhereUniqueInput,
    @Arg('input', (type) => CartItemUpdateInput)
    { quantity }: CartItemUpdateInput,
    @Ctx() ctx: IContext,
  ) {
    const cartItem = await CartItem.findOne({
      where: {
        id,
        cart: {
          userId: ctx.user?.id,
          completedAt: null,
        },
      },
    });

    if (!cartItem) {
      throw new Error('Cart mismatch');
    }

    cartItem.quantity = quantity;

    return cartItem.save();
  }

  @Authorized([UserRole.MEMBER])
  @Mutation(() => CartItem)
  public async cartItemDestroy(
    @Arg('where', (type) => CartItemWhereUniqueInput)
    { id }: CartItemWhereUniqueInput,
    @Ctx() ctx: IContext,
  ) {
    const cartItem = await CartItem.findOne({
      where: {
        id,
        cart: {
          userId: ctx.user?.id,
          completedAt: null,
        },
      },
      include: ['product'],
    });

    if (!cartItem) {
      throw new Error('Cart mismatch');
    }

    await CartItem.destroy({
      where: {
        id,
      },
    });

    return cartItem;
  }

  @FieldResolver((type) => Product)
  async product(@Root() cartItem: CartItem): Promise<Product> {
    return cartItem.$get<Product>('product') as Promise<Product>;
  }
}
