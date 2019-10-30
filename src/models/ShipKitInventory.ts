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
import { ShipKit } from './ShipKit';

@Table({
  tableName: 'shipkit_inventories',
  underscored: true,
})
export class ShipKitInventory extends Model<ShipKitInventory> {
  @Field((type) => ID)
  @PrimaryKey
  @Default(Sequelize.literal('uuid_generate_v4()'))
  @Column(DataType.UUID)
  public id!: string;

  @ForeignKey(() => ShipKit)
  @Column(DataType.UUID)
  public shipKitId!: string;

  @ForeignKey(() => Inventory)
  @Column(DataType.UUID)
  public inventoryId!: string;
}
