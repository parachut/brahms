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
  BeforeDestroy,
} from 'sequelize-typescript';
import { Field, ID, ObjectType } from 'type-graphql';

import { InventoryStatus } from '../enums/inventoryStatus';
import { ShipmentDirection } from '../enums/shipmentDirection';
import { ShipmentStatus } from '../enums/shipmentStatus';
import { ShipmentType } from '../enums/shipmentType';
import { Address } from './Address';
import { Cart } from './Cart';
import { Inventory } from './Inventory';
import { ShipKit } from './ShipKit';
import { ShipmentInspection } from './ShipmentInspection';
import { ShipmentInventory } from './ShipmentInventory';
import { User } from './User';
import { Warehouse } from './Warehouse';
import { createEasyPostAddress } from '../utils/createEasyPostAddress';
import { sendEmail } from '../utils/sendEmail';

const easyPost = new EasyPost(process.env.EASYPOST);

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

  @ForeignKey(() => ShipKit)
  @Column(DataType.UUID)
  public shipKitId?: string;

  @BelongsTo(() => ShipKit)
  public shipKit?: ShipKit;

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

  @BelongsToMany(
    () => Inventory,
    () => ShipmentInventory,
  )
  inventory: Inventory[];

  @Field()
  @CreatedAt
  public createdAt!: Date;

  @UpdatedAt
  public updatedAt!: Date;

  @AfterUpdate
  static async checkDelivered(instance: Shipment) {
    if (
      instance.changed('status') &&
      instance.status === ShipmentStatus.DELIVERED
    ) {
      const user = await User.findByPk(instance.userId, {
        include: ['addresses'],
      });

      const inventory = (await instance.$get<Inventory>('inventory', {
        include: ['product'],
      })) as Inventory[];

      const address = (await instance.$get<Address>('address')) as Address;

      if (
        instance.direction === ShipmentDirection.OUTBOUND &&
        instance.type === ShipmentType.ACCESS
      ) {
        const cart = await Cart.findByPk(instance.cartId);

        await sendEmail({
          to: cart.user.email,
          id: 12952495,
          data: {
            purchase_date: new Date(cart.completedAt).toLocaleDateString(),
            name: cart.user.name,
            chutItems: cart.items.map((item) => ({
              image: item.product.images.length
                ? `https://parachut.imgix.net/${item.product.images[0]}`
                : '',
              name: item.product.name,
              points: item.product.points,
            })),
          },
        });

        if (!user.billingDay) {
          user.billingDay = new Date().getDate();
          await user.save();
        }

        await Inventory.update(
          {
            status: InventoryStatus.WITHMEMBER,
          },
          {
            where: {
              id: { [Op.in]: inventory.map((item) => item.id) },
            },
            individualHooks: true,
          },
        );
      }

      if (
        instance.direction === ShipmentDirection.OUTBOUND &&
        instance.type === ShipmentType.ACCESS
      ) {
        sendEmail({
          to: user.email,
          id: 13494640,
          data: {
            name: user.parsedName.first,
            date: new Date().toLocaleDateString(),
            formattedAddress: address.formattedAddress,
            trackerUrl: instance.publicUrl,
            chutItems: inventory.map((i) => i.product.name),
          },
        });
      }
    }
  }

  @BeforeCreate
  static async createEasyPostShipment(instance: Shipment) {
    let cart: Cart;

    if (instance.cartId) {
      cart = await Cart.findByPk(instance.cartId);

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
        order: [['createdAt', 'desc']],
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
          order: [['createdAt', 'desc']],
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
        from_address:
          instance.direction === ShipmentDirection.INBOUND
            ? address.easyPostId
            : warehouse.easyPostId,
        options: {
          delivery_confirmation: 'ADULT_SIGNATURE',
          label_size: '4X6',
          address_validation_level: 0,
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

        if (!instance.service || instance.service === 'Ground') {
          if (easyPostShipment.rates.length > 2) {
            const rates = groupBy(
              easyPostShipment.rates.filter((r) => r.delivery_days),
              (o) => {
                return Number(o.delivery_days);
              },
            );

            const levels = Object.keys(rates).map(Number);
            const level = instance.expedited
              ? rates[levels[0]]
              : rates[levels[1]];

            const uspsExpress = easyPostShipment.rates.find(
              (rate) => rate.service === 'Express',
            );

            if (uspsExpress) {
              rates[levels[0]].push(uspsExpress);
            }

            const rateSorted = sortBy(level, (o) => Number(o.rate));

            instance.cost = Number(rateSorted[0].rate);
            instance.service = rateSorted[0].service;
            instance.estDeliveryDate = new Date(rateSorted[0].delivery_date);
            await easyPostShipment.buy(rateSorted[0]);
          } else {
            throw new Error('No rates available');
          }
        } else {
          const rate = easyPostShipment.rates.find(
            (rate) => rate.service === instance.service,
          );
          await easyPostShipment.buy(rate);

          instance.estDeliveryDate = new Date(rate.delivery_date);
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

      if (instance.cartId && instance.type === ShipmentType.ACCESS) {
        sendEmail({
          to: cart.user.email,
          id: 12950070,
          data: {
            purchase_date: new Date(cart.completedAt).toLocaleDateString(),
            name: cart.user.name,
            chutItems: cart.items.map((item) => ({
              image: item.product.images.length
                ? `https://parachut.imgix.net/${item.product.images[0]}`
                : '',
              name: item.product.name,
            })),
            address: shipment.address.formattedAddress,
            estDeliveryDate: new Date(
              shipment.estDeliveryDate,
            ).toLocaleDateString(),
            publicUrl: shipment.publicUrl,
            trackingCode: shipment.trackingCode,
          },
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

  @BeforeDestroy
  static async refundShipment(instance: Shipment) {
    const easyPostShipment = await easyPost.Shipment.retrieve(
      instance.easyPostId,
    );

    await easyPostShipment.refund();
  }
}
