import { Op } from 'sequelize';
import {
  Arg,
  Authorized,
  Ctx,
  FieldResolver,
  Info,
  Int,
  Mutation,
  Query,
  Resolver,
  Root,
} from 'type-graphql';

import { ShipmentDirection } from '../enums/shipmentDirection';
import { Cart } from '../models/Cart';
import { Inventory } from '../models/Inventory';
import { Product } from '../models/Product';
import { Shipment } from '../models/Shipment';
import { IContext } from '../utils/context.interface';
import { UserRole } from '../enums/userRole';
import { InventoryCreateInput } from '../classes/inventoryCreate.input';
import { InventoryUpdateInput } from '../classes/inventoryUpdate.input';
import { InventoryWhereUniqueInput } from '../classes/inventoryWhereUnique.input';

@Resolver(Inventory)
export default class InventoryResolver {
  @Authorized([UserRole.MEMBER])
  @Query((returns) => [Inventory])
  public async inventory(@Ctx() ctx: IContext) {
    if (ctx.user) {
      return Inventory.findAll({
        where: {
          userId: ctx.user.id,
        },
      });
    }

    throw new Error('Unauthorised.');
  }

  @Authorized([UserRole.MEMBER])
  @Mutation(() => Inventory)
  public async inventoryCreate(
    @Arg('input', (type) => InventoryCreateInput)
    newInventory: InventoryCreateInput,
    @Ctx() ctx: IContext,
  ) {
    if (ctx.user) {
      const inventory = await Inventory.create({
        ...newInventory,
        userId: ctx.user.id,
      });

      ctx.analytics.track({
        userId: ctx.user.id,
        event: 'Inventory Added',
        properties: {
          product_id: newInventory.productId,
          condition: newInventory.condition,
          missing_essentials: newInventory.missingEssentials,
        },
      });

      return inventory;
    }

    throw new Error('Unauthorized');
  }

  @Authorized([UserRole.MEMBER])
  @Mutation(() => Inventory)
  public async inventoryUpdate(
    @Arg('input', (type) => InventoryUpdateInput)
    { condition, productId, missingEssentials }: InventoryUpdateInput,
    @Arg('where', (type) => InventoryWhereUniqueInput)
    { id }: InventoryWhereUniqueInput,
    @Ctx() ctx: IContext,
  ) {
    if (ctx.user) {
      const inventory = await Inventory.findOne({
        where: {
          id,
          userId: ctx.user.id,
        },
      });

      if (productId) {
        inventory.productId = productId;
      }

      if (condition) {
        inventory.condition = condition;
      }

      if (missingEssentials) {
        inventory.missingEssentials = missingEssentials;
      }

      if (!inventory) {
        throw new Error('Inventory not found.');
      }

      ctx.analytics.track({
        userId: ctx.user.id,
        event: 'Inventory Updated',
        properties: {
          product_id: productId,
          condition: condition,
          missing_essentials: missingEssentials,
        },
      });

      return inventory.save();
    }

    throw new Error('Unauthorized');
  }

  @FieldResolver((type) => Product)
  async product(@Root() inventory: Inventory): Promise<Product> {
    return ((await inventory.$get<Product>('product')) as Product)!;
  }

  @FieldResolver((type) => Cart, { nullable: true })
  async lastCart(
    @Root() inventory: Inventory,
    @Ctx() ctx: IContext,
  ): Promise<Cart> | null {
    try {
      const carts = await inventory.$get('carts', {
        where: {
          completedAt: { [Op.ne]: null },
          userId: ctx.user.id,
        },
      });

      return carts[0];
    } catch (e) {
      console.log(e);
    }
  }

  @FieldResolver((type) => Shipment, { nullable: true })
  async lastShipment(
    @Root() inventory: Inventory,
    @Ctx() ctx: IContext,
  ): Promise<Shipment> | null {
    try {
      const shipments = await inventory.$get('shipments', {
        where: {
          direction: ShipmentDirection.OUTBOUND,
          userId: ctx.user.id,
        },
      });

      return shipments[0];
    } catch (e) {
      console.log(e);
    }
  }

  @FieldResolver((type) => Shipment, { nullable: true })
  async lastReturn(
    @Root() inventory: Inventory,
    @Ctx() ctx: IContext,
  ): Promise<Shipment> | null {
    try {
      const shipments = await inventory.$get('shipments', {
        where: {
          direction: ShipmentDirection.INBOUND,
          userId: ctx.user.id,
        },
      });

      return shipments[0];
    } catch (e) {
      console.log(e);
    }
  }
}
