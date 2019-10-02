import Sequelize from 'sequelize';
import {
  Column,
  DataType,
  Default,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { Field, ID } from 'type-graphql';

import { Inventory } from './Inventory';
import { Request } from './Request';

@Table({
  tableName: 'request_inventory',
  underscored: true,
})
export class RequestInventory extends Model<RequestInventory> {
  @Field((type) => ID)
  @PrimaryKey
  @Default(Sequelize.literal('uuid_generate_v4()'))
  @Column(DataType.UUID)
  public id!: string;

  @ForeignKey(() => Request)
  @Column(DataType.UUID)
  public requestId!: string;

  @ForeignKey(() => Inventory)
  @Column(DataType.UUID)
  public inventoryId!: string;
}
