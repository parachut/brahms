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
import { Subscription } from './Subscription';
import { User } from './User';

@ObjectType()
@Table({
  tableName: 'invoices',
  underscored: true,
})
export class Invoice extends Model<Invoice> {
  @Field((type) => ID)
  @PrimaryKey
  @Column
  id!: string;

  @Field({ nullable: true })
  @Column
  balance?: number;

  @Field()
  @Column
  collectionMethod!: string;

  @Field({ nullable: true })
  @Column
  customerNotes?: string;

  @Field({ nullable: true })
  @Column
  discount?: number;

  @Field({ nullable: true })
  @Column
  netTerms?: number;

  @Field({ nullable: true })
  @Column
  number?: number;

  @Field()
  @Column
  object!: string;

  @Field()
  @Column
  origin!: string;

  @Field()
  @Column
  paid!: number;

  @Field({ nullable: true })
  @Column
  poNumber?: string;

  @Field({ nullable: true })
  @Column
  previousInvoiceId?: string;

  @Field({ nullable: true })
  @Column
  refundableAmount?: string;

  @Field()
  @Column
  state!: string;

  @Field()
  @Column
  subtotal!: number;

  @Field({ nullable: true })
  @Column
  tax?: number;

  @Field()
  @Column
  total!: number;

  @Field({ nullable: true })
  @Column
  termsAndConditions?: string;

  @Field({ nullable: true })
  @Column
  type?: string;

  @Field({ nullable: true })
  @Column
  vatNumber?: string;

  @Field({ nullable: true })
  @Column
  vatReverseChargeNotes?: string;

  @Field((type) => [Pricing])
  @Column({
    type: 'json',
  })
  currencies!: Pricing[];

  @Field()
  @Column
  dueAt!: Date;

  @Field()
  @Column
  createdAt!: Date;

  @Field({ nullable: true })
  @Column
  closedAt?: Date;

  @ForeignKey(() => Subscription)
  @Column
  public subscriptionId!: string;

  @BelongsTo(() => Subscription, 'subscriptionId')
  public subscription?: Subscription;

  @ForeignKey(() => User)
  @Column(DataType.UUID)
  public userId!: string;

  @BelongsTo(() => User, 'userId')
  public user?: User;
}
