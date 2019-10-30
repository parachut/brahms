import map from 'lodash/map';
import pMap from 'p-map';
import Sequelize from 'sequelize';
import {
  AfterUpdate,
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

import { Address } from './Address';
import { ShipKitInventory } from './ShipKitInventory';
import { Inventory } from './Inventory';
import { Shipment } from './Shipment';
import { InventoryStatus } from '../enums/inventoryStatus';
import { ShipmentDirection } from '../enums/shipmentDirection';
import { ShipmentType } from '../enums/shipmentType';

import { User } from './User';

@ObjectType()
@Table({
  tableName: 'shipkits',
  underscored: true,
})
export class ShipKit extends Model<ShipKit> {
  /**
   * ID
   */
  @Field((type) => ID)
  @PrimaryKey
  @Default(Sequelize.literal('uuid_generate_v4()'))
  @Column(DataType.UUID)
  public id!: string;

  /**
   * Database Fields
   */
  @Field({ nullable: true })
  @Column
  public completedAt?: Date;

  @Field({ nullable: true })
  @Column
  public confirmedAt?: Date;

  @Field()
  @Default(true)
  @Column
  public airbox!: boolean;

  /**
   * Database Relationships
   */
  @BelongsTo(() => User)
  public user!: User;

  @ForeignKey(() => User)
  @Column(DataType.UUID)
  public userId!: string;

  @BelongsTo(() => Address)
  public address?: Address;

  @ForeignKey(() => Address)
  @Column(DataType.UUID)
  public addressId?: string;

  @HasMany(() => Shipment, 'requestId')
  public shipments: Shipment[];

  @BelongsToMany(() => Inventory, () => ShipKitInventory)
  public inventory: Inventory[];

  @CreatedAt
  public createdAt!: Date;

  @UpdatedAt
  public updatedAt!: Date;

  @AfterUpdate
  static async updateInventory(instance: ShipKit) {
    if (instance.changed('completedAt') && !instance.confirmedAt) {
      const inventory = await Inventory.findAll({
        where: {
          userId: instance.userId,
          status: InventoryStatus.NEW,
        },
      });

      const shipments: any[] = [];

      if (instance.airbox) {
        const airboxShipment = new Shipment({
          addressId: instance.addressId,
          userId: instance.userId,
          airbox: true,
          direction: ShipmentDirection.INBOUND,
          type: ShipmentType.EARN,
          requestId: instance.id,
        });

        shipments.push(airboxShipment);
      }

      const returnShipment = new Shipment({
        addressId: instance.addressId,
        userId: instance.userId,
        return: true,
        direction: ShipmentDirection.INBOUND,
        type: ShipmentType.EARN,
        requestId: instance.id,
      });

      shipments.push(returnShipment);

      await pMap(shipments, (s) => s.save(), {
        concurrency: 2,
      });

      await pMap(
        shipments,
        (s) => s.$set('inventory', inventory.map((i) => i.id)),
        {
          concurrency: 2,
        },
      );

      inventory.forEach((i) => {
        i.status = InventoryStatus.ACCEPTED;
      });

      await pMap(inventory, (i) => i.save(), {
        concurrency: 2,
      });

      await instance.$set('inventory', inventory.map((i) => i.id));

      instance.confirmedAt = new Date();
      await instance.save();
    }
  }
}
