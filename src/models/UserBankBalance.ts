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

@Table({
  tableName: 'user_bank_balance',
  underscored: true,
})
export class UserBankBalance extends Model<UserBankBalance> {
  @PrimaryKey
  @Default(Sequelize.literal('uuid_generate_v4()'))
  @Column(DataType.UUID)
  public id!: string;

  @Column
  public available?: number;

  @Column
  public name!: string;

  @Column
  public limit?: number;

  @Column
  public current!: number;

  @BelongsTo(() => User)
  user!: User;

  @ForeignKey(() => User)
  @Column(DataType.UUID)
  userId!: string;

  @CreatedAt
  public createdAt!: Date;
}
