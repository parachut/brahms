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

import { Invoice } from './Invoice';
import { User } from './User';
import { PaymentMethod } from '../classes/paymentMethod';
import { TransactionPaymentGateway } from '../classes/transactionPaymentGateway';

@ObjectType()
@Table({
  tableName: 'transactions',
  underscored: true,
})
export class Transaction extends Model<Transaction> {
  @Field((type) => ID)
  @PrimaryKey
  @Column
  id!: string;

  @Field()
  @Column
  amount!: number;

  @Field({ nullable: true })
  @Column
  avsCheck!: string;

  @Field({ nullable: true })
  @Column
  collectionMethod?: string;

  @Field({ nullable: true })
  @Column
  currency?: string;

  @Field({ nullable: true })
  @Column
  customerMessage?: string;

  @Field({ nullable: true })
  @Column
  customerMessageLocale?: string;

  @Field({ nullable: true })
  @Column
  cvvCheck?: string;

  @Field({ nullable: true })
  @Column
  gatewayApprovalCode?: string;

  @Field({ nullable: true })
  @Column
  gatewayMessage?: string;

  @Field({ nullable: true })
  @Column
  gatewayReference?: string;

  @Field({ nullable: true })
  @Column
  gatewayResponseCode?: string;

  @Field({ nullable: true })
  @Column
  gatewayResponseTime?: number;

  @Field({ nullable: true })
  @Column
  ipAddressCountry?: string;

  @Field({ nullable: true })
  @Column
  ipAddressV4?: string;

  @Field()
  @Column
  object!: string;

  @Field({ nullable: true })
  @Column
  origin?: string;

  @Field({ nullable: true })
  @Column
  originalTransactionId?: string;

  @Field((type) => TransactionPaymentGateway, { nullable: true })
  @Column({
    type: 'json',
  })
  postage?: TransactionPaymentGateway;

  @Field((type) => PaymentMethod)
  @Column({
    type: 'json',
  })
  paymentMethod!: PaymentMethod;

  @Field({ nullable: true })
  @Column
  refunded?: boolean;

  @Field()
  @Column
  status!: string;

  @Field()
  @Column
  statusCode!: string;

  @Field()
  @Column
  statusMessage!: string;

  @Field()
  @Column
  success!: boolean;

  @Field()
  @Column
  type!: string;

  @Field()
  @Column
  uuid!: string;

  @Field()
  @Column
  createdAt!: Date;

  @Field({ nullable: true })
  @Column
  collectedAt?: Date;

  @Field({ nullable: true })
  @Column
  voidedAt?: Date;

  @ForeignKey(() => Invoice)
  @Column
  public invoiceId!: string;

  @BelongsTo(() => Invoice, 'invoiceId')
  public invoice!: Invoice;

  @ForeignKey(() => User)
  @Column(DataType.UUID)
  public userId!: string;

  @BelongsTo(() => User, 'userId')
  public user!: User;
}
