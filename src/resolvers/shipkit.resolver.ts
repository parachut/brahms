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

import { ShipKitUpdateInput } from '../classes/shipKitUpdate.input';
import { UserRole } from '../enums/userRole';
import { Address } from '../models/Address';
import { Inventory } from '../models/Inventory';
import { ShipKit } from '../models/ShipKit';
import { Shipment } from '../models/Shipment';
import { User } from '../models/User';
import { IContext } from '../utils/context.interface';

@Resolver(ShipKit)
export default class ShipKitResolver {
  @Authorized([UserRole.MEMBER])
  @Query((returns) => ShipKit)
  public async shipKit(@Ctx() ctx: IContext) {
    if (ctx.user) {
      let shipKit = await ShipKit.findOne({
        where: {
          userId: ctx.user.id,
          completedAt: null,
        },
        include: [
          {
            association: 'inventory',
            include: ['product'],
          },
        ],
      });

      if (!shipKit) {
        const user = await User.findByPk(ctx.user.id, {
          include: ['addresses'],
        });

        const address = user.addresses.length
          ? user.addresses.find((address) => address.primary) ||
            user.addresses[0]
          : null;

        shipKit = new ShipKit({
          addressId: address ? address.id : null,
          userId: ctx.user.id,
        });

        await shipKit.save();
      }

      if (!shipKit.address) {
        const user = await User.findByPk(ctx.user.id, {
          include: ['addresses'],
        });

        if (user.addresses.length) {
          const address = user.addresses.length
            ? user.addresses.find((address) => address.primary) ||
              user.addresses[0]
            : null;

          shipKit.addressId = address.id;
        }
      }

      await shipKit.save();

      return shipKit;
    }

    throw new Error('Unauthorised.');
  }

  @Authorized([UserRole.MEMBER])
  @Query((returns) => [ShipKit])
  public async shipkits(@Ctx() ctx: IContext) {
    if (ctx.user) {
      const shipkits = await ShipKit.findAll({
        where: {
          userId: ctx.user.id,
          completedAt: { [Op.ne]: null },
        },
      });

      return shipkits;
    }
    throw new Error('Unauthorised.');
  }

  @Authorized([UserRole.MEMBER])
  @Mutation(() => ShipKit)
  public async shipKitUpdate(
    @Arg('input', (type) => ShipKitUpdateInput)
    { addressId, airbox }: ShipKitUpdateInput,
    @Ctx() ctx: IContext,
  ) {
    if (ctx.user) {
      const shipKit = await ShipKit.findOne({
        where: { userId: ctx.user.id, completedAt: null },
      });

      console.log(shipKit);

      const event: any = {
        event: 'Contributor Step Completed',
        properties: {
          request_id: shipKit.id,
          shipping_method: 'UPS',
          step: 0,
        },
        userId: ctx.user.id,
      };

      if (!isUndefined(addressId)) {
        shipKit.addressId = addressId;
        event.properties.step = 3;
      }

      if (!isUndefined(airbox)) {
        shipKit.airbox = airbox;
        event.properties.step = 2;
      }

      ctx.analytics.track(event);
      return shipKit.save();
    }

    throw new Error('Unauthorized');
  }

  @Authorized([UserRole.MEMBER])
  @Mutation(() => ShipKit)
  public async shipKitComplete(@Ctx() ctx: IContext) {
    if (ctx.user) {
      const shipKit = await ShipKit.findOne({
        where: { userId: ctx.user.id, completedAt: null },
      });

      const user = await User.findByPk(ctx.user.id);

      const event: any = {
        event: 'ShipKit Completed',
        properties: {
          request_id: shipKit.id,
          step: 0,
        },
        userId: ctx.user.id,
      };

      shipKit.completedAt = new Date();

      ctx.analytics.track(event);
      return shipKit.save();
    }

    throw new Error('Unauthorized');
  }

  @FieldResolver((type) => [Inventory])
  async inventory(@Root() shipKit: ShipKit): Promise<Inventory[]> {
    return ((await shipKit.$get<Inventory>('inventory')) as Inventory[])!;
  }

  @FieldResolver((type) => Address, { nullable: true })
  async address(@Root() shipKit: ShipKit): Promise<Address> {
    return (await shipKit.$get<Address>('address')) as Address;
  }

  @FieldResolver((type) => [Shipment], { nullable: true })
  async shipments(@Root() shipKit: ShipKit): Promise<Shipment[]> {
    return (await shipKit.$get<Shipment>('shipments')) as Shipment[];
  }
}
