import {
  BelongsTo,
  Column,
  Model,
  PrimaryKey,
  Table,
  ForeignKey,
  DataType,
} from 'sequelize-typescript';
import { Field, ID, ObjectType } from 'type-graphql';

import { PlanAddOn } from './PlanAddOn';
import { Subscription } from './Subscription';

@ObjectType()
@Table({
  tableName: 'subscription_add_ons',
  underscored: true,
})
export class SubscriptionAddOn extends Model<SubscriptionAddOn> {
  @Field((type) => ID)
  @PrimaryKey
  @Column
  id!: string;

  @Field()
  @Column
  object!: string;

  @Field()
  @Column
  quantity!: number;

  @Field({ nullable: true })
  @Column({ type: 'real' })
  unitAmount?: number;

  @Field()
  @Column
  createdAt!: Date;

  @Field({ nullable: true })
  @Column
  expiredAt?: Date;

  @ForeignKey(() => Subscription)
  @Column
  public subscriptionId!: string;

  @BelongsTo(() => Subscription, 'subscriptionId')
  public subscription!: Subscription;

  @ForeignKey(() => PlanAddOn)
  @Column
  public planAddOnId!: string;

  @BelongsTo(() => PlanAddOn, 'planAddOnId')
  public planAddOn!: PlanAddOn;
}
