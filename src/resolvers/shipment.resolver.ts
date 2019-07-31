import { Arg, Authorized, Ctx, Mutation, Query, Resolver } from 'type-graphql';

import { ShipmentCreateInput } from '../classes/shipmentCreate.input';
import { ShipmentWhereUniqueInput } from '../classes/shipmentWhereUnique.input';
import { UserRole } from '../enums/userRole';
import { ShipmentDirection } from '../enums/ShipmentDirection';
import { Shipment } from '../models/Shipment';
import { IContext } from '../utils/context.interface';

@Resolver(Shipment)
export default class ShipmentResolver {
  @Authorized([UserRole.MEMBER])
  @Query((returns) => Shipment)
  public async shipment(
    @Arg('where', (type) => ShipmentWhereUniqueInput)
    { id }: ShipmentWhereUniqueInput,
    @Ctx() ctx: IContext,
  ) {
    if (ctx.user) {
      return Shipment.findOne({
        where: {
          id,
          user: ctx.user.id,
        },
      });
    }

    throw new Error('Unathorised.');
  }

  @Authorized([UserRole.MEMBER])
  @Query((returns) => [Shipment])
  public async shipments(@Ctx() ctx: IContext) {
    if (ctx.user) {
      return Shipment.findAll({
        where: { userId: ctx.user.id },
      });
    }
    throw new Error('Unathorised.');
  }

  @Authorized([UserRole.MEMBER])
  @Mutation(() => Shipment)
  public async shipmentCreate(
    @Arg('input', (type) => ShipmentCreateInput)
    { inventoryIds }: ShipmentCreateInput,
    @Ctx() ctx: IContext,
  ) {
    if (ctx.user) {
      return Shipment.create({
        inventoryIds,
        direction: ShipmentDirection.INBOUND,
        userId: ctx.user.id,
      });
    }

    throw new Error('Unauthorized');
  }
}
