import { Op } from 'sequelize';
import { Ctx, FieldResolver, Resolver, Root } from 'type-graphql';

import { ShipmentDirection } from '../enums/shipmentDirection';
import { Cart } from '../models/Cart';
import { Inventory } from '../models/Inventory';
import { Product } from '../models/Product';
import { Shipment } from '../models/Shipment';
import { IContext } from '../utils/context.interface';

@Resolver(Inventory)
export default class InventoryResolver {
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

      console.log(shipments);

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

      console.log(shipments);

      return shipments[0];
    } catch (e) {
      console.log(e);
    }
  }
}
