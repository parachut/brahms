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
  UpdatedAt,
} from 'sequelize-typescript';
import { Field, ID, ObjectType } from 'type-graphql';

import { User } from './User';

@ObjectType()
@Table({
  tableName: 'deposits',
  underscored: true,
})
export class Deposit extends Model<Deposit> {
  @Field((type) => ID)
  @PrimaryKey
  @Default(Sequelize.literal('uuid_generate_v4()'))
  @Column(DataType.UUID)
  public id!: string;

  @Field()
  @Default(0)
  @Column
  public amount!: number;

  @Field({ nullable: true })
  @Column
  public notes?: string;

  @Field({ nullable: true })
  @Column
  public transferId?: string;

  @BelongsTo(() => User, 'userId')
  public user!: User;

  @ForeignKey(() => User)
  @Column(DataType.UUID)
  public userId!: string;

  @CreatedAt
  public createdAt!: Date;

  @UpdatedAt
  public updatedAt!: Date;
}
