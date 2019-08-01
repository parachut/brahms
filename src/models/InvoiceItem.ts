import Sequelize from 'sequelize';
import {
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  Default,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
  Unique,
  UpdatedAt,
} from 'sequelize-typescript';
import { Field, ID, Int, ObjectType } from 'type-graphql';

import { Inventory } from './Inventory';
import { Invoice } from './Invoice';

@ObjectType()
@Table
export class InvoiceItem extends Model<InvoiceItem> {
  @Field((type) => ID)
  @PrimaryKey
  @Default(Sequelize.literal('uuid_generate_v4()'))
  @Column(DataType.UUID)
  public id!: string;

  @Field((type) => Int)
  @Default(0)
  @Column
  public dailyRate!: number;

  @Field()
  @Default(0)
  @Column
  public commission!: number;

  @Field()
  @Default(false)
  @Column
  public protectionPlan!: boolean;

  @Field()
  @Unique
  @Column
  public stripeId!: string;

  @BelongsTo(() => Invoice)
  public invoice!: Invoice;

  @ForeignKey(() => Invoice)
  @Column(DataType.UUID)
  public invoiceId!: string;

  @BelongsTo(() => Invoice)
  public inventory!: Inventory;

  @ForeignKey(() => Inventory)
  @Column(DataType.UUID)
  public inventoryId!: string;

  @CreatedAt
  public createdAt!: Date;

  @UpdatedAt
  public updatedAt!: Date;
}
