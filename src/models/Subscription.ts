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

import { Plan } from './Plan';
import { User } from './User';

@ObjectType()
@Table({
  tableName: 'subscriptions',
  underscored: true,
})
export class Subscription extends Model<Subscription> {
  @Field((type) => ID)
  @PrimaryKey
  @Column
  id!: string;

  @Field()
  @Column
  activatedAt!: Date;

  @Field()
  @Column({ type: 'real' })
  addOnsTotal!: number;

  @Field()
  @Column
  autoRenew!: boolean;

  @Field({ nullable: true })
  @Column
  bankAccountAuthorizedAt?: Date;

  @Field({ nullable: true })
  @Column
  canceledAt?: Date;

  @Field()
  @Column
  collectionMethod!: string;

  @Field()
  @Column
  currency!: string;

  @Field({ nullable: true })
  @Column
  currentPeriodEndsAt?: Date;

  @Field({ nullable: true })
  @Column
  currentPeriodStartedAt?: Date;

  @Field({ nullable: true })
  @Column
  currentTermEndsAt?: Date;

  @Field({ nullable: true })
  @Column
  currentTermStartedAt?: Date;

  @Field({ nullable: true })
  @Column
  customerNotes?: string;

  @Field({ nullable: true })
  @Column
  expirationReason?: string;

  @Field({ nullable: true })
  @Column({ type: 'real' })
  netTerms?: number;

  @Field()
  @Column
  object!: string;

  @Field({ nullable: true })
  @Column
  quantity?: number;

  @Field({ nullable: true })
  @Column
  remainingBillingCycles?: number;

  @Field({ nullable: true })
  @Column
  remainingPauseCycles?: number;

  @Field({ nullable: true })
  @Column
  renewalBillingCycles?: number;

  @Field()
  @Column
  state!: string;

  @Field()
  @Column({ type: 'real' })
  subtotal!: number;

  @Field({ nullable: true })
  @Column
  totalBillingCycles?: number;

  @Field({ nullable: true })
  @Column
  unitAmount!: number;

  @Field({ nullable: true })
  @Column
  trialEndsAt?: Date;

  @Field({ nullable: true })
  @Column
  trialStartedAt?: Date;

  @Field()
  @Column
  createdAt!: Date;

  @Field({ nullable: true })
  @Column
  deletedAt?: Date;

  @Field({ nullable: true })
  @Column
  expiresAt?: Date;

  @Field({ nullable: true })
  @Column
  pausedAt?: Date;

  @ForeignKey(() => User)
  @Column(DataType.UUID)
  userId!: string;

  @BelongsTo(() => User, 'userId')
  user!: User;

  @ForeignKey(() => Plan)
  @Column
  planId!: string;

  @BelongsTo(() => Plan, 'planId')
  plan!: Plan;
}
