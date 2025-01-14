import { ClassType, Field, ObjectType, Int } from 'type-graphql';

export function PaginatedResponse<TItem>(TItemClass: ClassType<TItem>) {
  // `isAbstract` decorator option is mandatory to prevent registering in schema
  @ObjectType({ isAbstract: true })
  abstract class PaginatedResponseClass {
    @Field((type) => [TItemClass])
    items: TItem[];

    @Field((type) => Int)
    total: number;

    @Field((type) => Int)
    from: number;

    @Field((type) => Int)
    size: number;

    @Field()
    hasMore: boolean;
  }
  return PaginatedResponseClass;
}
