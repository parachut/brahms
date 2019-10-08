import EasyPost from '@easypost/api';
import groupBy from 'lodash/groupBy';
import sortBy from 'lodash/sortBy';
import Sequelize, { Op } from 'sequelize';
import {
  AfterCreate,
  AfterUpdate,
  BeforeCreate,
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

import { InventoryStatus } from '../enums/inventoryStatus';
import { ShipmentDirection } from '../enums/shipmentDirection';
import { ShipmentStatus } from '../enums/shipmentStatus';
import { ShipmentType } from '../enums/shipmentType';
import { createQueue } from '../redis';
import { Address } from './Address';
import { Cart } from './Cart';
import { Inventory } from './Inventory';
import { Request } from './Request';
import { ShipmentEvent } from './ShipmentEvent';
import { ShipmentInspection } from './ShipmentInspection';
import { ShipmentInventory } from './ShipmentInventory';
import { User } from './User';
import { Warehouse } from './Warehouse';
import { createEasyPostAddress } from '../utils/createEasyPostAddress';

const easyPost = new EasyPost(process.env.EASYPOST);
const communicationQueue = createQueue('communication-queue');

@ObjectType()
@Table({
  tableName: 'shipments',
  underscored: true,
})
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
  @Default('UPS')
  @Column
  public carrier?: string;

  @Field({ nullable: true })
  @Column
  public carrierDeliveredAt?: Date;

  @Field({ nullable: true })
  @Column
  public carrierReceivedAt?: Date;

  @Field({ nullable: true })
  @Default(Sequelize.NOW)
  @Column
  public estDeliveryDate?: Date;

  @Field()
  @Default(false)
  @Column
  public expedited?: boolean;

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

  @ForeignKey(() => Request)
  @Column(DataType.UUID)
  public requestId?: string;

  @BelongsTo(() => Request)
  public request?: Request;

  @ForeignKey(() => Cart)
  @Column(DataType.UUID)
  public cartId?: string;

  @BelongsTo(() => Cart)
  public cart?: Cart;

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

  @AfterUpdate
  static async checkDelivered(instance: Shipment) {
    if (
      instance.changed('status') &&
      instance.status === ShipmentStatus.DELIVERED &&
      instance.direction === ShipmentDirection.OUTBOUND &&
      instance.type === ShipmentType.ACCESS
    ) {
      communicationQueue.add('send-delivery-email', {
        shipmentId: instance.id,
      });

      const user = await User.findByPk(instance.userId);
      if (!user.billingDay) {
        user.billingDay = new Date().getDate();
        await user.save();
      }

      const inventory = (await instance.$get<Inventory>(
        'inventory',
      )) as Inventory[];

      await Inventory.update(
        {
          status: InventoryStatus.WITHMEMBER,
        },
        {
          where: {
            id: { [Op.in]: inventory.map((item) => item.id) },
          },
        },
      );
    }
  }

  @BeforeCreate
  static async createEasyPostShipment(instance: Shipment) {
    if (instance.cartId) {
      const cart = await Cart.findByPk(instance.cartId);

      if (!instance.addressId) {
        instance.addressId = cart.addressId;
      }

      if (!instance.userId) {
        instance.userId = cart.userId;
      }
    }

    if (!instance.addressId) {
      const address = await Address.findOne({
        where: { userId: instance.userId },
        order: [['primary', 'DESC']],
      });

      if (address) {
        instance.addressId = address.id;
      }
    }

    if (!instance.warehouseId) {
      const warehouse = await Warehouse.findOne({
        where: {},
      });

      instance.warehouseId = warehouse.id;
    }

    if (!instance.pickup && !instance.easyPostId) {
      const parcel = new easyPost.Parcel({
        height: instance.height,
        length: instance.length,
        weight: 1,
        width: instance.width,
      });

      let [address, warehouse] = await Promise.all([
        Address.findByPk(instance.addressId),
        Warehouse.findOne({
          where: {},
        }),
      ]);

      if (!address || !warehouse) {
        throw new Error('Unabled to purchase label without address.');
      }

      let warehouseEasyPostAddress = null;
      let addressEasyPostAddress = null;

      try {
        warehouseEasyPostAddress = await easyPost.Address.retrieve(
          warehouse.easyPostId,
        );
        addressEasyPostAddress = await easyPost.Address.retrieve(
          address.easyPostId,
        );
      } catch (e) {}

      if (!addressEasyPostAddress) {
        address = await createEasyPostAddress(address);
      }

      if (!warehouseEasyPostAddress) {
        warehouse = await createEasyPostAddress(warehouse);
      }

      const shipment: any = {
        buyer_address: warehouse.easyPostId,
        carrier_account: process.env.EASYPOST_CARRIER_ACCOUNT,
        from_address:
          instance.direction === ShipmentDirection.INBOUND
            ? address.easyPostId
            : warehouse.easyPostId,
        options: {
          delivery_confirmation: 'ADULT_SIGNATURE',
          label_size: '4X6',
        },
        parcel,
        to_address:
          instance.direction === ShipmentDirection.INBOUND
            ? warehouse.easyPostId
            : address.easyPostId,
      };

      const easyPostShipment = new easyPost.Shipment(shipment);

      try {
        await easyPostShipment.save();

        if (!instance.service) {
          const rates = groupBy(easyPostShipment.rates, (o) => {
            return Number(o.delivery_days);
          });

          const levels = Object.keys(rates);
          if (levels && levels.length) {
            const level = String(
              instance.expedited ? 0 : Math.min(levels.length - 1, 1),
            );

            const costSort = sortBy(rates[levels[level]], [
              (o) => {
                return Number(o.rate);
              },
            ]);
            instance.service = costSort[0].service;
            await easyPostShipment.buy(costSort[0]);
          } else {
            throw new Error('No rates available');
          }
        } else {
          await easyPostShipment.buy(
            easyPostShipment.rates.find(
              (rate) => rate.service === instance.service,
            ),
          );
        }

        await easyPostShipment.convertLabelFormat('ZPL');
      } catch (e) {
        console.log(JSON.stringify(e), 'error');
        throw new Error('Unable to create shipment label.');
      }

      instance.easyPostId = easyPostShipment.id;
      instance.trackingCode = easyPostShipment.tracking_code;
      instance.publicUrl = easyPostShipment.tracker.public_url;
      instance.labelUrlZPL = easyPostShipment.postage_label.label_zpl_url;
      instance.labelUrl = easyPostShipment.postage_label.label_url;
      instance.estDeliveryDate = new Date(
        easyPostShipment.rates[0].delivery_date,
      );

      if (instance.cartId && instance.type === ShipmentType.ACCESS) {
        await communicationQueue.add('send-outbound-access-shipment-email', {
          shipmentId: shipment.id,
        });
      }
    }
  }

  @AfterCreate
  static async updateInventory(instance: Shipment) {
    const inventory = (await instance.$get<Inventory>(
      'inventory',
    )) as Inventory[];

    if (inventory && inventory.length) {
      for (const i of inventory) {
        i.status = InventoryStatus.SHIPMENTPREP;
        await i.save();
      }
    }
  }
}
