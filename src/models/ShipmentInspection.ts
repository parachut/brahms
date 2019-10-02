import Sequelize from 'sequelize';
import {
  BelongsTo,
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
import { File } from './File';
import { Inventory } from './Inventory';
import { Shipment } from './Shipment';
import { User } from './User';

@ObjectType()
@Table({
  tableName: 'shipment_inspection',
  underscored: true,
})
export class ShipmentInspection extends Model<ShipmentInspection> {
  @Field((type) => ID)
  @PrimaryKey
  @Default(Sequelize.literal('uuid_generate_v4()'))
  @Column(DataType.UUID)
  public id!: string;

  @Field((type) => InventoryCondition)
  @Default(InventoryCondition.NEW)
  @Column(
    DataType.ENUM({
      values: Object.values(InventoryCondition),
    }),
  )
  public condition!: InventoryCondition;

  @Field()
  @Default(true)
  @Column
  public hasEssentials!: boolean;

  @Field((type) => [String])
  @Default([])
  @Column(DataType.ARRAY(DataType.STRING(1024)))
  public missingEssentials!: string[];

  @Field((type) => [String])
  @Default([])
  @Column(DataType.ARRAY(DataType.STRING(1024)))
  public images!: string[];

  @Field({ nullable: true })
  @Column
  public notes?: string;

  @ForeignKey(() => User)
  @Column(DataType.UUID)
  public userId!: string;

  @BelongsTo(() => User)
  public user!: User;

  @ForeignKey(() => Inventory)
  @Column(DataType.UUID)
  public inventoryId!: string;

  @BelongsTo(() => Inventory)
  public inventory!: Inventory;

  @ForeignKey(() => Shipment)
  @Column(DataType.UUID)
  public shipmentId!: string;

  @BelongsTo(() => Shipment)
  public shipment!: Shipment;

  @HasMany(() => File, 'shipmentInspectionId')
  public file?: File;

  @CreatedAt
  public createdAt!: Date;

  @UpdatedAt
  public updatedAt!: Date;
}
