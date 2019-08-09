import {
  Arg,
  Authorized,
  Ctx,
  ID,
  Mutation,
  Query,
  Resolver,
  Subscription,
  Root,
} from 'type-graphql';

import { AddressCreateInput } from '../classes/addressCreate.input';
import { AddressWhereUniqueInput } from '../classes/addressWhereUnique.input';
import { Notification, NotificationPayload } from '../classes/notification';
import { Phone } from '../decorators/phone';
import { UserRole } from '../enums/userRole';
import { Address } from '../models/Address';
import { IContext } from '../utils/context.interface';

@Resolver(Address)
export default class AddressResolver {
  @Authorized([UserRole.MEMBER])
  @Query((returns) => Address)
  public async address(
    @Arg('id', (type) => ID) id: string,
    @Ctx() ctx: IContext,
  ) {
    if (ctx.user) {
      const address = await Address.findOne({
        where: { id, userId: ctx.user.id },
      });

      if (!address) {
        throw new Error('Address not found');
      }

      return address;
    }

    throw new Error('Unathorised.');
  }

  @Authorized([UserRole.MEMBER])
  @Query((returns) => [Address])
  public async addresses(@Ctx() ctx: IContext) {
    if (ctx.user) {
      const addresses = await Address.findAll({
        where: { userId: ctx.user.id },
      });

      return addresses;
    }
    throw new Error('Unathorised.');
  }

  @Authorized([UserRole.MEMBER])
  @Mutation(() => Address)
  @Phone()
  public async addressCreate(
    @Arg('input')
    input: AddressCreateInput,
    @Ctx() ctx: IContext,
  ) {
    if (ctx.user) {
      const newAddress = await Address.create({
        ...input,
        userId: ctx.user.id,
      });

      return newAddress;
    }

    throw new Error('Unauthorized');
  }

  @Authorized([UserRole.MEMBER])
  @Mutation(() => Address)
  public async addressDestroy(
    @Arg('where', (type) => AddressWhereUniqueInput)
    { id }: AddressWhereUniqueInput,
    @Ctx() ctx: IContext,
  ) {
    if (ctx.user) {
      const address = await Address.findOne({
        where: { id, userId: ctx.user.id },
      });

      if (!address) {
        throw new Error('Address not found');
      }

      await address.destroy();
      return address;
    }

    throw new Error('Unauthorized');
  }

  @Subscription({
    topics: 'ADDRESS_UPDATED',
    filter: ({ payload, args, context }) => {
      return payload.message.userId === context.currentUser;
    },
  })
  addressUpdated(@Root() { id, message }: NotificationPayload): Notification {
    return { id, message: message.id, date: new Date() };
  }
}
