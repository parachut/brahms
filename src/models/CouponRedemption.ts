import {
  BelongsTo,
  Column,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { Field, ID, ObjectType } from 'type-graphql';

import { Coupon } from './Coupon';
import { Subscription } from './Subscription';

@ObjectType()
@Table({
  tableName: 'coupon_redemptions',
  underscored: true,
})
export class CouponRedemption extends Model<CouponRedemption> {
  @Field((type) => ID)
  @PrimaryKey
  @Column
  id!: string;

  @Field({ nullable: true })
  @Column({ type: 'real' })
  discounted?: number;

  @Field()
  @Column
  object!: string;

  @Field()
  @Column
  state!: string;

  @Field()
  @Column
  createdAt!: Date;

  @Field()
  @Column
  couponId!: string;

  @BelongsTo(() => Coupon, 'couponId')
  public coupon!: Coupon;

  @Field()
  @Column
  subscriptionId!: string;

  @BelongsTo(() => Subscription, 'subscriptionId')
  public subscription!: Subscription;
}
