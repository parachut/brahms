import EasyPost from '@easypost/api';
import Sequelize from 'sequelize';
import {
  AfterCreate,
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
  BeforeCreate,
} from 'sequelize-typescript';
import { Field, ID, ObjectType, Root } from 'type-graphql';

import { ShipmentDirection } from '../enums/shipmentDirection';
import { ShipmentStatus } from '../enums/shipmentStatus';
import { ShipmentType } from '../enums/shipmentType';
import { Address } from './Address';
import { Cart } from './Cart';
import { Inventory } from './Inventory';
import { ShipmentEvent } from './ShipmentEvent';
import { ShipmentInspection } from './ShipmentInspection';
import { ShipmentInventory } from './ShipmentInventory';
import { User } from './User';
import { Warehouse } from './Warehouse';

const easyPost = new EasyPost(process.env.EASYPOST);

@ObjectType()
@Table
export class Shipment extends Model<Shipment> {
  @Field((type) => ID)
  @PrimaryKey
  @Default(Sequelize.literal('uuid_generate_v4()'))
  @Column(DataType.UUID)
  public id!: string;

  @Field()
  @Default(false)
  @Column
  public airbox!: boolean;

  @Field()
  @Default(false)
  @Column
  public pickup!: boolean;

  @Field({ nullable: true })
  @Column
  public carrier?: string;

  @Field({ nullable: true })
  @Column
  public carrierDeliveredAt?: Date;

  @Field({ nullable: true })
  @Column
  public carrierReceivedAt?: Date;

  @Field({ nullable: true })
  @Column
  public estDeliveryDate?: Date;

  @Field()
  @Column(DataType.FLOAT)
  public cost?: number;

  @Field((type) => ShipmentDirection)
  @Default(ShipmentDirection.OUTBOUND)
  @Column(
    DataType.ENUM({
      values: Object.values(ShipmentDirection),
    }),
  )
  public direction!: ShipmentDirection;

  @Field({ nullable: true })
  @Column
  public easyPostId?: string;

  @Field()
  @Default(12)
  @Column(DataType.FLOAT)
  public height!: number;

  @Field({ nullable: true })
  @Column
  public labelUrl?: string;

  @Field({ nullable: true })
  @Column
  public labelUrlZPL?: string;

  @Field()
  @Default(12)
  @Column(DataType.FLOAT)
  public length!: number;

  @Field({ nullable: true })
  @Column
  public publicUrl?: string;

  @Field()
  @Default('Ground')
  @Column
  public service!: string;

  @Field((type) => ShipmentStatus)
  @Default(ShipmentStatus.PRETRANSIT)
  @Column(
    DataType.ENUM({
      values: Object.values(ShipmentStatus),
    }),
  )
  public status!: ShipmentStatus;

  @Field({ nullable: true })
  @Column
  public signedBy?: string;

  @Field({ nullable: true })
  @Column
  public trackingCode?: string;

  @Field((type) => ShipmentType)
  @Default(ShipmentType.ACCESS)
  @Column(
    DataType.ENUM({
      values: Object.values(ShipmentType),
    }),
  )
  public type!: ShipmentType;

  @Field()
  @Default(12)
  @Column(DataType.FLOAT)
  public weight!: number;

  @Field()
  @Default(12)
  @Column(DataType.FLOAT)
  public width!: number;

  @ForeignKey(() => User)
  @Column(DataType.UUID)
  public userId!: string;

  @BelongsTo(() => User)
  public user!: User;

  @ForeignKey(() => Cart)
  @Column(DataType.UUID)
  public cartId!: string;

  @BelongsTo(() => Cart)
  public cart!: Cart;

  @ForeignKey(() => Warehouse)
  @Column(DataType.UUID)
  public warehouseId!: string;

  @BelongsTo(() => Warehouse)
  public warehouse!: Warehouse;

  @ForeignKey(() => Address)
  @Column(DataType.UUID)
  public addressId!: string;

  @BelongsTo(() => Address)
  public address!: Address;

  @BelongsToMany(() => Inventory, () => ShipmentInventory)
  inventory: Inventory[];

  @HasMany(() => ShipmentInspection, 'shipmentId')
  public inspections?: ShipmentInspection[];

  @HasMany(() => ShipmentEvent, 'shipmentId')
  public events?: ShipmentEvent[];

  @Field()
  @CreatedAt
  public createdAt!: Date;

  @UpdatedAt
  public updatedAt!: Date;

  @BeforeCreate
  static async findRelatedInformation(instance: Shipment) {
    console.log(instance);
    if (instance.cartId) {
      const cart = await Cart.findByPk(instance.cartId);

      if (!instance.addressId) {
        instance.addressId = cart.addressId;
      }

      if (!instance.userId) {
        instance.userId = cart.userId;
      }
    }

    if (!instance.warehouseId) {
      const warehouse = await Warehouse.findOne({
        where: {},
      });

      instance.warehouseId = warehouse.id;
    }
  }

  @AfterCreate
  static async createEasyPostShipment(instance: Shipment) {
    if (!instance.pickup && !instance.easyPostId) {
      const parcel = new easyPost.Parcel({
        height: instance.height,
        length: instance.length,
        weight: 1,
        width: instance.width,
      });

      if (!instance.addressId) {
        const addresses = await Address.findAll({
          where: {
            userId: instance.userId,
          },
          order: [['primary', 'DESC'], ['createdAt', 'DESC']],
          limit: 2,
          attributes: ['id', 'primary', 'easyPostId'],
        });

        instance.addressId = addresses ? addresses[0].id : instance.addressId;
      }

      const [address, warehouse] = await Promise.all([
        Address.findByPk(instance.addressId),
        Warehouse.findOne({
          where: {},
        }),
      ]);

      if (!address || !warehouse) {
        throw new Error('Unabled to purchase label without address.');
      }

      const shipment: any = {
        buyer_address: warehouse.easyPostId,
        carrier_account: process.env.EASYPOST_CARRIER_ACCOUNT,
        from_address: warehouse.easyPostId,
        is_return: instance.direction === ShipmentDirection.INBOUND,
        options: {
          delivery_confirmation:
            instance.direction !== ShipmentDirection.INBOUND
              ? 'ADULT_SIGNATURE'
              : undefined,
          label_size: '4X6',
        },
        parcel,
        service: '3DaySelect',
        to_address: address.easyPostId,
      };

      if (ShipmentDirection.OUTBOUND) {
        shipment.service = instance.service;
      }

      const easyPostShipment = new easyPost.Shipment(shipment);

      try {
        await easyPostShipment.save();
        await easyPostShipment.convertLabelFormat('ZPL');
      } catch (e) {
        throw new Error('Unable to create shipment label.');
      }

      instance.easyPostId = easyPostShipment.id;
      instance.trackingCode = easyPostShipment.tracking_code;
      instance.publicUrl = easyPostShipment.tracker.public_url;
      instance.labelUrlZPL = easyPostShipment.postage_label.label_zpl_url;
      instance.labelUrl = easyPostShipment.postage_label.label_url;

      await instance.save();
    }
  }
}
