import { Field, ObjectType } from 'type-graphql';

import { CouponDiscountCurrency } from './couponDiscountCurrency';
import { CouponDiscountTrial } from './couponDiscountTrial';

@ObjectType()
export class CouponDiscount {
  @Field((type) => [CouponDiscountCurrency], { nullable: true })
  currencies?: CouponDiscountCurrency[];

  @Field({ nullable: true })
  percent?: number;

  @Field({ nullable: true })
  trial?: CouponDiscountTrial;

  @Field()
  type!: string;
}
