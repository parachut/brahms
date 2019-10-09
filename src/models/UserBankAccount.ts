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
} from 'sequelize-typescript';
import { Field, ID, ObjectType } from 'type-graphql';

import { User } from './User';

@ObjectType()
@Table({
  tableName: 'user_bank_accounts',
  underscored: true,
})
export class UserBankAccount extends Model<UserBankAccount> {
  @Field((type) => ID)
  @PrimaryKey
  @Default(Sequelize.literal('uuid_generate_v4()'))
  @Column(DataType.UUID)
  public id!: string;

  @Column
  public accountId!: string;

  @Field()
  @Default(false)
  @Column
  public primary!: boolean;

  @Field()
  @Column
  public mask!: string;

  @Field()
  @Column
  public name!: string;

  @Column
  public subtype!: string;

  @Column
  public plaidUrl!: string;

  @BelongsTo(() => User)
  user!: User;

  @ForeignKey(() => User)
  @Column(DataType.UUID)
  userId!: string;

  @CreatedAt
  public createdAt!: Date;
}
