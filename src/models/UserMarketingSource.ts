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
  tableName: 'user_marketing_sources',
  underscored: true,
})
export class UserMarketingSource extends Model<UserMarketingSource> {
  @Field((type) => ID)
  @PrimaryKey
  @Default(Sequelize.literal('uuid_generate_v4()'))
  @Column(DataType.UUID)
  public id!: string;

  @Field()
  @Column
  public campaign!: string;

  @Field({ nullable: true })
  @Column
  public medium?: string;

  @Field()
  @Column
  public source!: string;

  @BelongsTo(() => User)
  user!: User;

  @ForeignKey(() => User)
  @Column(DataType.UUID)
  userId!: string;

  @CreatedAt
  public createdAt!: Date;
}
