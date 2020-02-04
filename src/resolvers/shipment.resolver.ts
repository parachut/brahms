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
    return Shipment.findOne({
      where: {
        id,
        user: ctx.user.id,
      },
    });
  }

  @Authorized([UserRole.MEMBER])
  @Query((returns) => [Shipment])
  public async shipments(@Ctx() ctx: IContext) {
    return Shipment.findAll({
      where: { userId: ctx.user.id },
      order: [['createdAt', 'DESC']],
    });
  }

  @Authorized([UserRole.MEMBER])
  @Mutation(() => Shipment)
  public async shipmentCreate(
    @Arg('input', (type) => ShipmentCreateInput)
    { inventoryIds, type }: ShipmentCreateInput,
    @Ctx() ctx: IContext,
  ) {
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
          individualHooks: true,
        },
      ),
    ]);

    await shipment.$set('inventory', inventoryIds);

    return shipment;
  }

  @FieldResolver((type) => [Inventory])
  async inventory(@Root() shipment: Shipment): Promise<Inventory[]> {
    return shipment.$get<Inventory>('inventory') as Promise<Inventory[]>;
  }
}
