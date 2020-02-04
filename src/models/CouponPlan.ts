import { Column, ForeignKey, Model, Table } from 'sequelize-typescript';

import { Coupon } from './Coupon';
import { Plan } from './Plan';

@Table({
  tableName: 'coupon_plans',
  underscored: true,
})
export class CouponPlan extends Model<CouponPlan> {
  @ForeignKey(() => Coupon)
  @Column
  couponId!: string;

  @ForeignKey(() => Plan)
  @Column
  planId!: string;
}
