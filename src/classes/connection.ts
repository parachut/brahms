import * as Relay from 'graphql-relay';
import { ArgsType, ClassType, Field, ObjectType } from 'type-graphql';

export type ConnectionCursor = Relay.ConnectionCursor;

@ObjectType()
export class PageInfo implements Relay.PageInfo {
  @Field()
  hasNextPage!: boolean;
  @Field()
  hasPreviousPage!: boolean;
  @Field((type) => String)
  startCursor?: ConnectionCursor;
  @Field((type) => String)
  endCursor?: ConnectionCursor;
}

export function connectionTypes<T extends ClassType>(
  name: string,
  nodeType: T,
) {
  @ObjectType(`${name}Edge`)
  class Edge implements Relay.Edge<T> {
    @Field(() => nodeType)
    node!: T;

    @Field((type) => String, {
      description: 'Used in `before` and `after` args',
    })
    cursor!: ConnectionCursor;
  }

  @ObjectType(`${name}Connection`)
  class Connection implements Relay.Connection<T> {
    @Field()
    pageInfo!: PageInfo;

    @Field(() => [Edge])
    edges!: Edge[];
  }
  return {
    Connection,
    Edge,
  };
}

export {
  connectionFromArray,
  connectionFromPromisedArray,
  connectionFromArraySlice,
  connectionFromPromisedArraySlice,
} from 'graphql-relay';
