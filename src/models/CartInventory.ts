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

import { Cart } from './Cart';
import { Inventory } from './Inventory';

@Table({
  tableName: 'cart_inventories',
  underscored: true,
})
export class CartInventory extends Model<CartInventory> {
  @Field((type) => ID)
  @PrimaryKey
  @Default(Sequelize.literal('uuid_generate_v4()'))
  @Column(DataType.UUID)
  public id!: string;

  @ForeignKey(() => Cart)
  @Column(DataType.UUID)
  public cartId!: string;

  @ForeignKey(() => Inventory)
  @Column(DataType.UUID)
  public inventoryId!: string;
}
