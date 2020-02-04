import {
  BelongsToMany,
  Column,
  CreatedAt,
  Default,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { Field, ID, ObjectType } from 'type-graphql';

import { Pricing } from '../classes/pricing';
import { Coupon } from './Coupon';
import { CouponPlan } from './CouponPlan';

@ObjectType()
@Table({
  tableName: 'plans',
  underscored: true,
})
export class Plan extends Model<Plan> {
  @Field((type) => ID)
  @PrimaryKey
  @Column
  id!: string;

  @Field({ nullable: true })
  @Column
  accountingCode?: string;

  @Field({ nullable: true })
  @Column
  autoRenew?: boolean;

  @Field()
  @Column
  code!: string;

  @Field((type) => [Pricing])
  @Column({
    type: 'json',
  })
  currencies!: Pricing[];

  @Field({ nullable: true })
  @Column
  description?: string;

  @Field({ nullable: true })
  @Column
  intervalLength?: number;

  @Field({ nullable: true })
  @Column
  intervalUnit?: string;

  @Field()
  @Column
  name!: string;

  @Field()
  @Column
  object!: string;

  @Field({ nullable: true })
  @Column
  setupFeeAccountingCode?: string;

  @Field()
  @Column
  state!: string;

  @Field({ nullable: true })
  @Column
  taxCode?: string;

  @Field()
  @Default(false)
  @Column
  taxExempt!: boolean;

  @Field()
  @Default(0)
  @Column
  totalBillingCycles!: number;

  @Field()
  @Default(0)
  @Column
  trialLength!: number;

  @Field({ nullable: true })
  @Column
  trialUnit?: string;

  @CreatedAt
  public createdAt!: Date;

  @Field({ nullable: true })
  @Column
  deletedAt?: Date;

  @BelongsToMany(
    () => Coupon,
    () => CouponPlan,
  )
  coupons: Array<Coupon & { CouponPlan: CouponPlan }>;
}
