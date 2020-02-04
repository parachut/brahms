import Queue from 'bull';
import {
  Arg,
  Authorized,
  Ctx,
  ID,
  Mutation,
  Query,
  Resolver,
  Root,
  Subscription,
} from 'type-graphql';

import { AddressCreateInput } from '../classes/addressCreate.input';
import { AddressUpdateInput } from '../classes/addressUpdate.input';
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

    throw new Error('Unauthorised.');
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
    throw new Error('Unauthorised.');
  }

  @Authorized([UserRole.MEMBER])
  @Mutation(() => Address)
  public async addressSetPrimary(
    @Arg('where')
    where: AddressWhereUniqueInput,
    @Ctx() ctx: IContext,
  ) {
    if (ctx.user) {
      await Address.update(
        {
          primary: false,
        },
        {
          where: {
            userId: ctx.user.id,
          },
        },
      );

      const address = await Address.findByPk(where.id);
      address.primary = true;

      return address.save();
    }

    throw new Error('Unauthorized');
  }

  @Authorized([UserRole.MEMBER])
  @Mutation(() => Address)
  @Phone()
  public async addressCreate(
    @Arg('input')
    input: AddressCreateInput,
    @Ctx() ctx: IContext,
  ) {
    return Address.create({
      ...input,
      userId: ctx.user?.id,
    });
  }

  @Authorized([UserRole.MEMBER])
  @Mutation(() => Address)
  @Phone()
  public async addressUpdate(
    @Arg('input')
    input: AddressUpdateInput,
    @Arg('where')
    where: AddressWhereUniqueInput,
    @Ctx() ctx: IContext,
  ) {
    const address = await Address.findByPk(where.id);

    const newAddress = await Address.create({
      ...address,
      ...input,
      userId: ctx.user?.id,
    });

    await address.destroy();
    return newAddress;
  }

  @Authorized([UserRole.MEMBER])
  @Mutation(() => Address)
  public async addressDestroy(
    @Arg('where', (type) => AddressWhereUniqueInput)
    { id }: AddressWhereUniqueInput,
    @Ctx() ctx: IContext,
  ) {
    const address = await Address.findOne({
      where: { id, userId: ctx.user?.id },
    });

    if (!address) {
      throw new Error('Address not found');
    }

    await address.destroy();

    return address;
  }
}
