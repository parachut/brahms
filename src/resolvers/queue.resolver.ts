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

import { QueueCreateInput } from '../classes/queueCreate.input';
import { QueueWhereUniqueInput } from '../classes/queueWhereUnique.input';
import { UserRole } from '../enums/userRole';
import { CartItem } from '../models/CartItem';
import { Product } from '../models/Product';
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
    return Queue.findOne({
      where: {
        id,
        user: ctx.user.id,
      },
    });
  }

  @Authorized([UserRole.MEMBER])
  @Query((returns) => [Queue])
  public async queues(@Ctx() ctx: IContext) {
    return Queue.findAll({
      where: { userId: ctx.user.id },
    });
  }

  @Authorized([UserRole.MEMBER])
  @Mutation(() => Queue)
  public async queueCreate(
    @Arg('input', (type) => QueueCreateInput)
    { productId }: QueueCreateInput,
    @Ctx() ctx: IContext,
  ) {
    return Queue.create({
      productId,
      userId: ctx.user.id,
    });
  }

  @Authorized([UserRole.MEMBER])
  @Mutation(() => Queue)
  public async queueDestroy(
    @Arg('where', (type) => QueueWhereUniqueInput)
    { id }: QueueWhereUniqueInput,
    @Ctx() ctx: IContext,
  ) {
    const queue = await Queue.findOne({
      where: {
        id,
        userId: ctx.user.id,
      },
    });

    await Queue.destroy({
      where: {
        id,
        userId: ctx.user.id,
      },
    });

    return queue;
  }

  @FieldResolver((type) => Product)
  async product(@Root() queue: Queue): Promise<Product> {
    return queue.$get<Product>('product') as Promise<Product>;
  }
}
