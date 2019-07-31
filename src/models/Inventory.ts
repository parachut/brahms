import Sequelize from 'sequelize';
import {
  BelongsTo,
  BelongsToMany,
  Column,
  CreatedAt,
  DataType,
  Default,
  ForeignKey,
  HasMany,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt,
} from 'sequelize-typescript';
import { Field, ID, ObjectType } from 'type-graphql';

import { InventoryCondition } from '../enums/inventoryCondition';
import { InventoryStatus } from '../enums/inventoryStatus';
import { Cart } from './Cart';
import { CartInventory } from './CartInventory';
import { InvoiceItem } from './InvoiceItem';
import { Product } from './Product';
import { Shipment } from './Shipment';
import { ShipmentInspection } from './ShipmentInspection';
import { ShipmentInventory } from './ShipmentInventory';
import { User } from './User';
import { Warehouse } from './Warehouse';

@ObjectType()
@Table
export class Inventory extends Model<Inventory> {
  @Field((type) => ID)
  @PrimaryKey
  @Default(Sequelize.literal('uuid_generate_v4()'))
  @Column(DataType.UUID)
  public id!: string;

  @Default(true)
  @Column
  public active!: boolean;

  @Default(true)
  @Column
  public autoPoints!: boolean;

  @Column
  public bin?: string;

  @Field((type) => InventoryCondition)
  @Default(InventoryCondition.NEW)
  @Column(
    DataType.ENUM({
      values: Object.values(InventoryCondition),
    }),
  )
  public condition!: InventoryCondition;

  @Default(true)
  @Column
  public hasEssentials!: boolean;

  @Default([])
  @Column(DataType.ARRAY(DataType.STRING(1024)))
  public images?: string[];

  @Column('Int')
  public maxPoints?: number;

  @Column('Int')
  public minPoints?: number;

  @Default([])
  @Column(DataType.ARRAY(DataType.STRING(1024)))
  public missingEssentials!: string[];

  @Column('Int')
  public points?: number;

  @Field({ nullable: true })
  @Column
  public serial?: string;

  @Column
  public sku?: string;

  @Default(InventoryStatus.NEW)
  @Column(
    DataType.ENUM({
      values: Object.values(InventoryStatus),
    }),
  )
  public status!: InventoryStatus;

  @BelongsToMany(() => Shipment, () => ShipmentInventory)
  shipments: Shipment[];

  @BelongsToMany(() => Cart, () => CartInventory)
  carts: Cart[];

  @BelongsTo(() => Product)
  product: Product;

  @ForeignKey(() => Product)
  @Column(DataType.UUID)
  public productId!: string;

  @BelongsTo(() => User)
  public user!: User;

  @ForeignKey(() => User)
  @Column(DataType.UUID)
  public userId!: string;

  @BelongsTo(() => User)
  public member!: User;

  @ForeignKey(() => User)
  @Column(DataType.UUID)
  public memberId!: string;

  @BelongsTo(() => Warehouse)
  public warehouse!: Warehouse;

  @ForeignKey(() => Warehouse)
  @Column(DataType.UUID)
  public warehouseId!: string;

  @HasMany(() => InvoiceItem, 'inventoryId')
  public invoiceItems!: InvoiceItem[];

  @HasMany(() => ShipmentInspection, 'inventoryId')
  public inspections?: ShipmentInspection[];

  @CreatedAt
  public createdAt!: Date;

  @UpdatedAt
  public updatedAt!: Date;
}
