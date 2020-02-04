import { differenceInCalendarDays } from 'date-fns';
import { last } from 'lodash';
import { Op, QueryTypes } from 'sequelize';
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
import sortBy from 'lodash/sortBy';

import { InventoryCreateInput } from '../classes/inventoryCreate.input';
import { InventoryHistory } from '../classes/inventoryHistory';
import { InventoryUpdateInput } from '../classes/inventoryUpdate.input';
import { InventoryWhereInput } from '../classes/inventoryWhere.input';
import { InventoryWhereUniqueInput } from '../classes/inventoryWhereUnique.input';
import { InventoryTotalIncome } from '../classes/inventoryTotalIncome';
import { InventoryStatus } from '../enums/inventoryStatus';
import { ShipmentDirection } from '../enums/shipmentDirection';
import { ShipmentType } from '../enums/shipmentType';
import { UserRole } from '../enums/userRole';
import { Cart } from '../models/Cart';
import { Income } from '../models/Income';
import { Inventory } from '../models/Inventory';
import { Product } from '../models/Product';
import { Shipment } from '../models/Shipment';
import { calcDailyCommission } from '../utils/calc';
import { IContext } from '../utils/context.interface';
import { sequelize } from '../db';

@Resolver(Inventory)
export default class InventoryResolver {
  @Authorized([UserRole.MEMBER])
  @Query((returns) => [Inventory])
  public async inventory(
    @Arg('where', (type) => InventoryWhereInput, { nullable: true })
    where: InventoryWhereInput = {},
    @Ctx() ctx: IContext,
  ) {
    if (where && where.status) {
      where.status = { [Op.in]: where.status } as any;
    }

    return Inventory.findAll({
      where: {
        ...where,
        userId: ctx.user.id,
      },
    });
  }

  @Authorized([UserRole.MEMBER])
  @Mutation(() => Inventory)
  public async inventoryCreate(
    @Arg('input', (type) => InventoryCreateInput)
    newInventory: InventoryCreateInput,
    @Ctx() ctx: IContext,
  ) {
    return Inventory.create({
      ...newInventory,
      userId: ctx.user.id,
    });
  }

  @Authorized([UserRole.MEMBER])
  @Mutation(() => Inventory)
  public async inventoryUpdate(
    @Arg('input', (type) => InventoryUpdateInput)
    inventoryInput: InventoryUpdateInput,
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
        throw new Error('Inventory not found.');
      }

      Object.assign(inventory, inventoryInput);

      return inventory.save();
    }

    throw new Error('Unauthorized');
  }

  @Authorized([UserRole.MEMBER])
  @Mutation(() => Inventory)
  public async inventoryReturn(
    @Arg('where', (type) => InventoryWhereUniqueInput)
    { id }: InventoryWhereUniqueInput,
    @Ctx() ctx: IContext,
  ) {
    const inventory = await Inventory.findOne({
      where: {
        id,
        userId: ctx.user.id,
      },
    });

    if (inventory.status === InventoryStatus.INWAREHOUSE) {
      inventory.status = InventoryStatus.RETURNING;
      inventory.markedForReturn = true;
    } else if (inventory.status === InventoryStatus.RETURNING) {
      inventory.status = InventoryStatus.INWAREHOUSE;
      inventory.markedForReturn = false;
    }

    return inventory.save();
  }

  @Authorized([UserRole.MEMBER])
  @Mutation(() => Inventory)
  public async inventoryDestroy(
    @Arg('where', (type) => InventoryWhereUniqueInput)
    { id }: InventoryWhereUniqueInput,
    @Ctx() ctx: IContext,
  ) {
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

    return inventory;
  }

  @FieldResolver((type) => Product)
  async product(@Root() inventory: Inventory): Promise<Product> {
    return inventory.$get<Product>('product') as Promise<Product>;
  }

  @FieldResolver((type) => Cart, { nullable: true })
  async lastCart(
    @Root() inventory: Inventory,
    @Ctx() ctx: IContext,
  ): Promise<Cart> | null {
    return Cart.findOne({
      where: {
        completedAt: { [Op.ne]: null },
        userId: ctx.user.id,
      },
      include: [
        {
          required: true,
          model: Inventory,
          through: { where: { id: inventory.id } },
        },
      ],
      order: [['createdAt', 'DESC']],
    });
  }

  @FieldResolver((type) => Shipment, { nullable: true })
  async lastShipment(
    @Root() inventory: Inventory,
    @Ctx() ctx: IContext,
  ): Promise<Shipment> | null {
    const shipment = await Shipment.findOne({
      where: {
        direction: ShipmentDirection.OUTBOUND,
        userId: ctx.user?.id,
      },
      include: [
        {
          required: true,
          model: Inventory,
          through: { where: { id: inventory.id } },
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    console.log(shipment);
    return shipment;
  }

  @FieldResolver((type) => Shipment, { nullable: true })
  async lastReturn(
    @Root() inventory: Inventory,
    @Ctx() ctx: IContext,
  ): Promise<Shipment> | null {
    return Shipment.findOne({
      where: {
        direction: ShipmentDirection.INBOUND,
        userId: ctx.user?.id,
      },
      include: [
        {
          required: true,
          model: Inventory,
          through: { where: { id: inventory.id } },
        },
      ],
      order: [['createdAt', 'DESC']],
    });
  }

  @FieldResolver((type) => InventoryTotalIncome, { nullable: true })
  async totalIncome(
    @Root() inventory: Inventory,
    @Ctx() ctx: IContext,
  ): Promise<InventoryTotalIncome> | null {
    try {
      const res: any = await sequelize.query(
        'SELECT sum(commission), count(id) FROM incomes WHERE inventory_id = :id',
        {
          replacements: {
            id: inventory.id,
          },
          type: QueryTypes.SELECT,
        },
      );

      if (res) {
        return {
          days: Number(res[0].count),
          total: Number(res[0].sum),
        };
      }
    } catch (e) {}

    return {
      total: 0,
      days: 0,
    };
  }

  @FieldResolver((type) => [InventoryHistory])
  async history(
    @Root() inventory: Inventory,
    @Ctx() ctx: IContext,
  ): Promise<InventoryHistory[]> {
    const groups: InventoryHistory[] = [];

    if (!inventory.shipments) {
      inventory.shipments = (await inventory.$get<Shipment>('shipments', {
        order: [['carrierReceivedAt', 'ASC']],
      })) as Shipment[];
    }

    if (!inventory.product) {
      inventory.product = (await inventory.$get<Product>('product')) as Product;
    }

    let shipments = inventory.shipments
      .filter((ship) => ship.type === ShipmentType.ACCESS)
      .filter(
        (ship) =>
          (ship.direction === ShipmentDirection.OUTBOUND &&
            ship.carrierDeliveredAt) ||
          (ship.direction === ShipmentDirection.INBOUND &&
            ship.carrierReceivedAt),
      );

    shipments = sortBy(shipments, (ship) =>
      ship.carrierReceivedAt
        ? ship.carrierReceivedAt.getTime()
        : ship.carrierDeliveredAt.getTime(),
    );

    shipments.forEach((shipment, i) => {
      if (
        shipment.direction === ShipmentDirection.OUTBOUND &&
        shipment.carrierDeliveredAt
      ) {
        const access: InventoryHistory = {
          out: shipment.carrierDeliveredAt,
          in: null,
          amount: 0,
          days: 0,
        };

        groups.push(access);
      } else {
        if (groups.length) {
          last(groups).in = shipment.carrierReceivedAt;
        }
      }

      const final = last(groups);

      if (
        final &&
        (final.in || i === inventory.shipments.length - 1 || final.in === null)
      ) {
        final.days = differenceInCalendarDays(
          final.in || new Date(),
          final.out,
        );
        final.amount =
          calcDailyCommission(
            inventory.product.points,
            new Date(inventory.createdAt).getTime() > 1576404000000
              ? false
              : true,
          ) * final.days;
      }
    });

    return groups;
  }
}
