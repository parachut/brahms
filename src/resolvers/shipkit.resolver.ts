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
        ? user.addresses.find((address) => address.primary) || user.addresses[0]
        : null;

      shipKit = new ShipKit({
        addressId: address ? address.id : null,
        userId: ctx.user.id,
      });

      return shipKit.save();
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

      return shipKit.save();
    }

    return shipKit;
  }

  @Authorized([UserRole.MEMBER])
  @Query((returns) => [ShipKit])
  public async shipkits(@Ctx() ctx: IContext) {
    return ShipKit.findAll({
      where: {
        userId: ctx.user.id,
        completedAt: { [Op.ne]: null },
      },
    });
  }

  @Authorized([UserRole.MEMBER])
  @Mutation(() => ShipKit)
  public async shipKitUpdate(
    @Arg('input', (type) => ShipKitUpdateInput)
    shipKitInput: ShipKitUpdateInput,
    @Ctx() ctx: IContext,
  ) {
    const shipKit = await ShipKit.findOne({
      where: { userId: ctx.user.id, completedAt: null },
    });

    Object.assign(shipKit, shipKitInput);

    return shipKit.save();
  }

  @Authorized([UserRole.MEMBER])
  @Mutation(() => ShipKit)
  public async shipKitComplete(@Ctx() ctx: IContext) {
    if (ctx.user) {
      const shipKit = await ShipKit.findOne({
        where: { userId: ctx.user.id, completedAt: null },
      });

      shipKit.completedAt = new Date();

      return shipKit.save();
    }

    throw new Error('Unauthorized');
  }

  @FieldResolver((type) => [Inventory])
  async inventory(@Root() shipKit: ShipKit): Promise<Inventory[]> {
    return shipKit.$get<Inventory>('inventory') as Promise<Inventory[]>;
  }

  @FieldResolver((type) => Address, { nullable: true })
  async address(@Root() shipKit: ShipKit): Promise<Address> {
    return shipKit.$get<Address>('address') as Promise<Address>;
  }

  @FieldResolver((type) => [Shipment], { nullable: true })
  async shipments(@Root() shipKit: ShipKit): Promise<Shipment[]> {
    return shipKit.$get<Shipment>('shipments') as Promise<Shipment[]>;
  }
}
