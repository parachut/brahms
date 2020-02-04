import { Field, ObjectType } from 'type-graphql';

@ObjectType()
export class CouponDiscountTrial {
  @Field()
  length!: number;

  @Field()
  unit!: string;
}
