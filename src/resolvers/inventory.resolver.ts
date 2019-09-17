import { differenceInCalendarDays } from 'date-fns';
import { last } from 'lodash';
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

import { InventoryCreateInput } from '../classes/inventoryCreate.input';
import { InventoryHistory } from '../classes/inventoryHistory';
import { InventoryUpdateInput } from '../classes/inventoryUpdate.input';
import { InventoryWhereInput } from '../classes/inventoryWhere.input';
import { InventoryWhereUniqueInput } from '../classes/inventoryWhereUnique.input';
import { ShipmentDirection } from '../enums/shipmentDirection';
import { ShipmentType } from '../enums/shipmentType';
import { UserRole } from '../enums/userRole';
import { Cart } from '../models/Cart';
import { Inventory } from '../models/Inventory';
import { Product } from '../models/Product';
import { Shipment } from '../models/Shipment';
import { calcDailyCommission } from '../utils/calc';
import { IContext } from '../utils/context.interface';

@Resolver(Inventory)
export default class InventoryResolver {
  @Authorized([UserRole.MEMBER])
  @Query((returns) => [Inventory])
  public async inventory(
    @Arg('where', (type) => InventoryWhereInput, { nullable: true })
    where: InventoryWhereInput,
    @Ctx() ctx: IContext,
  ) {
    if (ctx.user) {
      if (where.status) {
        where.status = { [Op.in]: where.status } as any;
      }

      return Inventory.findAll({
        where: {
          ...where,
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

  @Authorized([UserRole.MEMBER])
  @Mutation(() => Inventory)
  public async inventoryDestroy(
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

      if (!inventory) {
        throw new Error('Unauthorized');
      }

      await inventory.destroy();

      ctx.analytics.track({
        userId: ctx.user.id,
        event: 'Inventory Destroyed',
        properties: {
          product_id: inventory.productId,
          condition: inventory.condition,
          missing_essentials: inventory.missingEssentials,
        },
      });

      return inventory;
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

  @FieldResolver((type) => Shipment)
  async history(
    @Root() inventory: Inventory,
    @Ctx() ctx: IContext,
  ): Promise<InventoryHistory[]> {
    const groups: InventoryHistory[] = [];

    if (!inventory.shipments) {
      await inventory.$get('shipments', {
        where: {
          type: ShipmentType.ACCESS,
        },
      });
    }

    if (!inventory.product) {
      await inventory.$get('shipments', {
        where: {
          type: ShipmentType.ACCESS,
        },
      });
    }

    inventory.shipments.forEach((shipment, i) => {
      if (shipment.direction === ShipmentDirection.OUTBOUND) {
        const access: InventoryHistory = {
          out: shipment.carrierDeliveredAt,
          in: null,
          amount: 0,
          days: 0,
        };

        if (i + 1 === inventory.shipments.length) {
          access.in = new Date();
        }

        groups.push(access);
      } else {
        last(groups).in = shipment.carrierReceivedAt;
      }

      const final = last(groups);

      if (final.in) {
        final.days = differenceInCalendarDays(final.in, final.out);
        final.amount = calcDailyCommission(inventory.product.points);
      }
    });

    return groups;
  }
}
