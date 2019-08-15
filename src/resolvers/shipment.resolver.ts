import {
  Arg,
  Authorized,
  Ctx,
  Mutation,
  Query,
  Resolver,
  FieldResolver,
  Root,
} from 'type-graphql';
import { Op } from 'sequelize';

import { ShipmentCreateInput } from '../classes/shipmentCreate.input';
import { ShipmentWhereUniqueInput } from '../classes/shipmentWhereUnique.input';
import { UserRole } from '../enums/userRole';
import { ShipmentDirection } from '../enums/shipmentDirection';
import { Shipment } from '../models/Shipment';
import { Inventory } from '../models/Inventory';
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

    throw new Error('Unauthorised.');
  }

  @Authorized([UserRole.MEMBER])
  @Query((returns) => [Shipment])
  public async shipments(@Ctx() ctx: IContext) {
    if (ctx.user) {
      return Shipment.findAll({
        where: { userId: ctx.user.id },
      });
    }
    throw new Error('Unauthorised.');
  }

  @Authorized([UserRole.MEMBER])
  @Mutation(() => Shipment)
  public async shipmentCreate(
    @Arg('input', (type) => ShipmentCreateInput)
    { inventoryIds, type }: ShipmentCreateInput,
    @Ctx() ctx: IContext,
  ) {
    if (ctx.user) {
      const [shipment] = await Promise.all([
        Shipment.create({
          direction: ShipmentDirection.INBOUND,
          type,
          userId: ctx.user.id,
        }),
        Inventory.update(
          {
            status: 'RETURNING',
          },
          {
            where: {
              id: { [Op.in]: inventoryIds },
            },
          },
        ),
      ]);

      await shipment.$set('inventory', inventoryIds);

      return shipment;
    }

    throw new Error('Unauthorized');
  }

  @FieldResolver((type) => [Inventory])
  async inventory(@Root() shipment: Shipment): Promise<Inventory[]> {
    return (await shipment.$get<Inventory>('inventory')) as Inventory[];
  }
}
