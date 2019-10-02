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
import { Shipment } from './Shipment';

@Table({
  tableName: 'shipment_inventories',
  underscored: true,
})
export class ShipmentInventory extends Model<ShipmentInventory> {
  @Field((type) => ID)
  @PrimaryKey
  @Default(Sequelize.literal('uuid_generate_v4()'))
  @Column(DataType.UUID)
  public id!: string;

  @ForeignKey(() => Shipment)
  @Column(DataType.UUID)
  public shipmentId!: string;

  @ForeignKey(() => Inventory)
  @Column(DataType.UUID)
  public inventoryId!: string;
}
