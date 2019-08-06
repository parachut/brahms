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
    if (ctx.user) {
      const cart = await Cart.findOne({
        where: { userId: ctx.user.id, completedAt: null },
        attributes: ['id'],
      });

      const product = await Product.findByPk(productId);

      if (!cart) {
        throw new Error('Cart mismatch');
      }

      ctx.analytics.track({
        userId: ctx.user.id,
        event: 'Product Added',
        properties: {
          cart_id: cart.id,
          product_id: productId,
          sku: product.mfr,
          category: product.categoryId,
          name: product.name,
          brand: product.brandId,
          price: product.points,
          quantity,
          url: `https://www.parachut.co/warehouse/${product.slug}`,
          image_url: product.images.length
            ? `https://parachut.imgix.net/${product.images[0]}`
            : undefined,
        },
      });

      return CartItem.create({
        productId,
        quantity,
        userId: ctx.user.id,
        cartId: cart.id,
      });
    }

    throw new Error('Unauthorized');
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
    if (ctx.user) {
      const cart = await Cart.findOne({
        where: { userId: ctx.user.id, completedAt: null },
        attributes: ['id'],
        include: [
          {
            association: 'items',
            where: {
              id,
            },
            include: ['product'],
          },
        ],
      });

      if (!cart || !cart.items.length) {
        throw new Error('Cart mismatch');
      }

      const item = cart.items[0];

      ctx.analytics.track({
        userId: ctx.user.id,
        event: item.quantity < quantity ? 'Product Added' : 'Product Removed',
        properties: {
          cart_id: cart.id,
          product_id: item.product.id,
          sku: item.product.mfr,
          category: item.product.categoryId,
          name: item.product.name,
          brand: item.product.brandId,
          price: item.product.points,
          quantity,
          url: `https://www.parachut.co/warehouse/${item.product.slug}`,
          image_url: item.product.images.length
            ? `https://parachut.imgix.net/${item.product.images[0]}`
            : undefined,
        },
      });

      item.quantity = quantity;

      return item.save();
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
      const cart = await Cart.findOne({
        where: { userId: ctx.user.id, completedAt: null },
        attributes: ['id'],
      });

      if (!cart) {
        throw new Error('Cart mismatch');
      }

      const item = await CartItem.findOne({
        where: {
          id,
          cartId: cart.id,
        },
        include: ['product'],
      });

      if (!item) {
        throw new Error('Cart item not found.');
      }

      ctx.analytics.track({
        userId: ctx.user.id,
        event: 'Product Removed',
        properties: {
          cart_id: cart.id,
          product_id: item.product.id,
          sku: item.product.mfr,
          category: item.product.categoryId,
          name: item.product.name,
          brand: item.product.brandId,
          price: item.product.points,
          quantity: item.quantity,
          url: `https://www.parachut.co/warehouse/${item.product.slug}`,
          image_url: item.product.images.length
            ? `https://parachut.imgix.net/${item.product.images[0]}`
            : undefined,
        },
      });

      await CartItem.destroy({
        where: {
          id,
          cartId: cart.id,
        },
      });

      return item;
    }

    throw new Error('Unauthorized');
  }

  @FieldResolver((type) => Product)
  async product(@Root() cartItem: CartItem): Promise<Product> {
    return ((await cartItem.$get<Product>('product')) as Product)!;
  }
}
