import Sequelize from 'sequelize';
import {
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  Default,
  ForeignKey,
  HasMany,
  Model,
  PrimaryKey,
  Table,
  Unique,
  UpdatedAt,
} from 'sequelize-typescript';
import { Field, ID, Int, ObjectType } from 'type-graphql';

import { InvoiceStatus } from '../enums/invoiceStatus';
import { InvoiceItem } from './InvoiceItem';
import { User } from './User';

@ObjectType()
@Table
export class Invoice extends Model<Invoice> {
  @Field((type) => ID)
  @PrimaryKey
  @Default(Sequelize.literal('uuid_generate_v4()'))
  @Column(DataType.UUID)
  public id!: string;

  @Field((type) => Int)
  @Default(0)
  @Column(DataType.FLOAT)
  public total!: number;

  @Field()
  @Unique
  @Column
  public collectedAt?: Date;

  @Field({ nullable: true })
  @Column
  public stripeId?: string;

  @Field()
  @Default(true)
  @Column
  public subscription!: boolean;

  @Field((type) => InvoiceStatus)
  @Default(InvoiceStatus.OPEN)
  @Column(
    DataType.ENUM({
      values: Object.values(InvoiceStatus),
    }),
  )
  public status!: InvoiceStatus;

  @BelongsTo(() => User)
  public user!: User;

  @ForeignKey(() => User)
  @Column(DataType.UUID)
  public userId!: string;

  @HasMany(() => InvoiceItem, 'invoiceId')
  public items!: InvoiceItem[];

  @CreatedAt
  public createdAt!: Date;

  @UpdatedAt
  public updatedAt!: Date;
}
