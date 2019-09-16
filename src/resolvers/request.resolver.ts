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
import map from 'lodash/map';

import { RequestUpdateInput } from '../classes/requestUpdate.input';
import { UserRole } from '../enums/userRole';
import { Address } from '../models/Address';
import { Inventory } from '../models/Inventory';
import { Request } from '../models/Request';
import { Shipment } from '../models/Shipment';
import { User } from '../models/User';
import { IContext } from '../utils/context.interface';
import { InventoryStatus } from '../enums/inventoryStatus';

@Resolver(Request)
export default class RequestResolver {
  @Authorized([UserRole.MEMBER])
  @Query((returns) => Request)
  public async request(@Ctx() ctx: IContext) {
    if (ctx.user) {
      let request = await Request.findOne({
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

      if (!request) {
        const user = await User.findByPk(ctx.user.id, {
          include: ['addresses'],
        });

        const address = user.addresses.length
          ? user.addresses.find((address) => address.primary) ||
            user.addresses[0]
          : null;

        request = new Request({
          addressId: address ? address.id : null,
          userId: ctx.user.id,
        });

        await request.save();
      }

      return request;
    }

    throw new Error('Unauthorised.');
  }

  @Authorized([UserRole.MEMBER])
  @Query((returns) => [Request])
  public async requests(@Ctx() ctx: IContext) {
    if (ctx.user) {
      const requests = await Request.findAll({
        where: {
          userId: ctx.user.id,
          completedAt: { [Op.ne]: null },
        },
      });

      return requests;
    }
    throw new Error('Unauthorised.');
  }

  @Authorized([UserRole.MEMBER])
  @Mutation(() => Request)
  public async requestUpdate(
    @Arg('input', (type) => RequestUpdateInput)
    { addressId, airbox }: RequestUpdateInput,
    @Ctx() ctx: IContext,
  ) {
    if (ctx.user) {
      const request = await Request.findOne({
        where: { userId: ctx.user.id, completedAt: null },
      });

      const event: any = {
        event: 'Contributor Step Completed',
        properties: {
          request_id: request.id,
          shipping_method: 'UPS',
          step: 0,
        },
        userId: ctx.user.id,
      };

      if (!isUndefined(addressId)) {
        request.addressId = addressId;
        event.properties.step = 3;
      }

      if (!isUndefined(airbox)) {
        request.airbox = airbox;
        event.properties.step = 2;
      }

      ctx.analytics.track(event);
      return request.save();
    }

    throw new Error('Unauthorized');
  }

  @Authorized([UserRole.MEMBER])
  @Mutation(() => Request)
  public async requestComplete(@Ctx() ctx: IContext) {
    if (ctx.user) {
      const request = await Request.findOne({
        where: { userId: ctx.user.id, completedAt: null },
      });

      const event: any = {
        event: 'Request Completed',
        properties: {
          request_id: request.id,
          step: 0,
        },
        userId: ctx.user.id,
      };

      request.completedAt = new Date();

      ctx.analytics.track(event);
      return request.save();
    }

    throw new Error('Unauthorized');
  }

  @FieldResolver((type) => [Inventory])
  async inventory(@Root() request: Request): Promise<Inventory[]> {
    return ((await request.$get<Inventory>('inventory')) as Inventory[])!;
  }

  @FieldResolver((type) => Address, { nullable: true })
  async address(@Root() request: Request): Promise<Address> {
    return (await request.$get<Address>('address')) as Address;
  }

  @FieldResolver((type) => [Shipment], { nullable: true })
  async shipments(@Root() request: Request): Promise<Shipment[]> {
    return (await request.$get<Shipment>('shipments')) as Shipment[];
  }
}
