import { Arg, Authorized, Ctx, Mutation, Query, Resolver } from 'type-graphql';

import { QueueCreateInput } from '../classes/queueCreate.input';
import { QueueWhereUniqueInput } from '../classes/queueWhereUnique.input';
import { UserRole } from '../enums/userRole';
import { CartItem } from '../models/CartItem';
import { Queue } from '../models/Queue';
import { IContext } from '../utils/context.interface';

@Resolver(Queue)
export default class QueueResolver {
  @Authorized([UserRole.MEMBER])
  @Query((returns) => Queue)
  public async queue(
    @Arg('where', (type) => QueueWhereUniqueInput)
    { id }: QueueWhereUniqueInput,
    @Ctx() ctx: IContext,
  ) {
    if (ctx.user) {
      return Queue.findOne({
        where: {
          id,
          user: ctx.user.id,
        },
      });
    }

    throw new Error('Unathorised.');
  }

  @Authorized([UserRole.MEMBER])
  @Query((returns) => [Queue])
  public async queues(@Ctx() ctx: IContext) {
    if (ctx.user) {
      return Queue.findAll({
        where: { userId: ctx.user.id },
      });
    }
    throw new Error('Unathorised.');
  }

  @Authorized([UserRole.MEMBER])
  @Mutation(() => Queue)
  public async queueCreate(
    @Arg('input', (type) => QueueCreateInput)
    { productId }: QueueCreateInput,
    @Ctx() ctx: IContext,
  ) {
    if (ctx.user) {
      return Queue.create({
        productId,
        userId: ctx.user.id,
      });
    }

    throw new Error('Unauthorized');
  }

  @Authorized([UserRole.MEMBER])
  @Mutation(() => CartItem)
  public async queueDestroy(
    @Arg('where', (type) => QueueWhereUniqueInput)
    { id }: QueueWhereUniqueInput,
    @Ctx() ctx: IContext,
  ) {
    if (ctx.user) {
      return Queue.destroy({
        where: {
          id,
          userId: ctx.user.id,
        },
      });
    }

    throw new Error('Unauthorized');
  }
}
