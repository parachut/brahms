import { Field, ObjectType } from 'type-graphql';

@ObjectType()
export class CouponDiscountCurrency {
  @Field()
  currency!: string;

  @Field()
  amount!: number;
}
