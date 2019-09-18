import Sequelize from 'sequelize';
import {
  Column,
  CreatedAt,
  DataType,
  Default,
  HasMany,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt,
} from 'sequelize-typescript';
import { Field, ID, ObjectType } from 'type-graphql';

import { Inventory } from './Inventory';

@ObjectType()
@Table
export class Bin extends Model<Bin> {
  @Field((type) => ID)
  @PrimaryKey
  @Default(Sequelize.literal('uuid_generate_v4()'))
  @Column(DataType.UUID)
  public id!: string;

  @Field()
  @Column
  public cell!: Number;

  @Field()
  @Column
  public column!: Number;

  @Field()
  @Column
  public row!: Number;

  @Field()
  @Column
  public location!: String;

  @HasMany(() => Inventory, 'binId')
  public inventory: Inventory[];

  @CreatedAt
  public createdAt!: Date;

  @UpdatedAt
  public updatedAt!: Date;
}
