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

import { Pricing } from '../classes/pricing';
import { Plan } from './Plan';

@ObjectType()
@Table({
  tableName: 'plan_add_ons',
  underscored: true,
})
export class PlanAddOn extends Model<PlanAddOn> {
  @Field((type) => ID)
  @PrimaryKey
  @Column
  id!: string;

  @Field({ nullable: true })
  @Column
  accountingCode?: string;

  @Field()
  @Column
  code!: string;

  @Field((type) => [Pricing])
  @Column({
    type: 'json',
  })
  currencies!: Pricing[];

  @Field()
  @Column
  defaultQuantity!: number;

  @Field()
  @Column
  displayQuantity!: boolean;

  @Field()
  @Column
  object!: string;

  @Field()
  @Column
  name!: string;

  @Field()
  @Column
  state!: string;

  @Field({ nullable: true })
  @Column
  taxCode?: string;

  @Field()
  @Column
  createdAt!: Date;

  @Field({ nullable: true })
  @Column
  deletedAt?: Date;

  @ForeignKey(() => Plan)
  @Column
  public planId!: string;

  @BelongsTo(() => Plan, 'planId')
  public plan!: Plan;
}
