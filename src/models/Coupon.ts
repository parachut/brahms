import {
  BelongsToMany,
  Column,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { Field, ID, ObjectType } from 'type-graphql';

import { CouponDiscount } from '../classes/couponDiscount';
import { CouponPlan } from './CouponPlan';
import { Plan } from './Plan';

@ObjectType()
@Table({
  tableName: 'coupons',
  underscored: true,
})
export class Coupon extends Model<Coupon> {
  @Field((type) => ID)
  @PrimaryKey
  @Column
  id!: string;

  @Field()
  @Column
  appliesToAllPlans!: boolean;

  @Field()
  @Column
  appliesToNonPlanCharges!: boolean;

  @Field()
  @Column
  couponType!: string;

  @Field((type) => CouponDiscount)
  @Column({
    type: 'json',
  })
  discount!: CouponDiscount;

  @Field()
  @Column
  code!: string;

  @Field()
  @Column
  duration!: string;

  @Field({ nullable: true })
  @Column
  freeTrialAmount?: number;

  @Field({ nullable: true })
  @Column
  freeTrialUnit?: string;

  @Field({ nullable: true })
  @Column
  invoiceDescription?: string;

  @Field({ nullable: true })
  @Column
  maxRedemptions?: number;

  @Field({ nullable: true })
  @Column
  maxRedemptionsPerAccount?: number;

  @Field()
  @Column
  name!: string;

  @Field()
  @Column
  object!: string;

  @Field()
  @Column
  state!: string;

  @Field({ nullable: true })
  @Column
  temporalAmount?: number;

  @Field({ nullable: true })
  @Column
  temporalUnit?: string;

  @Field({ nullable: true })
  @Column
  uniqueCodeTemplate?: string;

  @Field({ nullable: true })
  @Column
  uniqueCouponCodesCount?: number;

  @Field()
  @Column
  createdAt!: Date;

  @Field({ nullable: true })
  @Column
  expiredAt?: Date;

  @Field({ nullable: true })
  @Column
  redeemBy?: Date;

  @BelongsToMany(
    () => Plan,
    () => CouponPlan,
  )
  plans: Array<Plan & { CouponPlan: CouponPlan }>;
}
