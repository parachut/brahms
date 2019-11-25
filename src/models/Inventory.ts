import Sequelize from 'sequelize';
import fetch from 'node-fetch';
import {
  BeforeUpdate,
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
  AfterCreate,
  AfterUpdate,
} from 'sequelize-typescript';
import { Field, ID, ObjectType } from 'type-graphql';

import { InventoryCondition } from '../enums/inventoryCondition';
import { InventoryStatus } from '../enums/inventoryStatus';
import { Bin } from './Bin';
import { Cart } from './Cart';
import { CartInventory } from './CartInventory';
import { Product } from './Product';
import { Income } from './Income';
import { Shipment } from './Shipment';
import { ShipmentInspection } from './ShipmentInspection';
import { ShipmentInventory } from './ShipmentInventory';
import { User } from './User';
import { Warehouse } from './Warehouse';
import { createQueue } from '../redis';
import { getParentCategories } from '../utils/getParentCategories';

const internalQueue = createQueue('internal-queue');

@ObjectType()
@Table({
  tableName: 'inventories',
  underscored: true,
})
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

  @Field()
  @Default(false)
  @Column
  public markedForReturn?: boolean;

  @Default([])
  @Column(DataType.ARRAY(DataType.STRING(1024)))
  public images?: string[];

  @Column
  public maxPoints?: number;

  @Column
  public minPoints?: number;

  @Field((type) => [String])
  @Default([])
  @Column(DataType.ARRAY(DataType.STRING(1024)))
  public missingEssentials!: string[];

  @Column
  public points?: number;

  @Field({ nullable: true })
  @Column
  public serial?: string;

  @Column
  public sku?: string;

  @Field((type) => InventoryStatus)
  @Default(InventoryStatus.NEW)
  @Column(
    DataType.ENUM({
      values: Object.values(InventoryStatus),
    }),
  )
  public status!: InventoryStatus;

  @BelongsToMany(
    () => Shipment,
    () => ShipmentInventory,
  )
  shipments: Shipment[];

  @BelongsToMany(
    () => Cart,
    () => CartInventory,
  )
  carts: Cart[];

  @BelongsTo(() => Bin)
  bin: Bin;

  @ForeignKey(() => Bin)
  @Column(DataType.UUID)
  public binId!: string;

  @BelongsTo(() => Product)
  product: Product;

  @ForeignKey(() => Product)
  @Column(DataType.UUID)
  public productId!: string;

  @BelongsTo(() => User, 'userId')
  public user!: User;

  @ForeignKey(() => User)
  @Column(DataType.UUID)
  public userId!: string;

  @BelongsTo(() => User, 'memberId')
  public member!: User;

  @ForeignKey(() => User)
  @Column(DataType.UUID)
  public memberId!: string;

  @BelongsTo(() => Warehouse)
  public warehouse!: Warehouse;

  @ForeignKey(() => Warehouse)
  @Column(DataType.UUID)
  public warehouseId!: string;

  @HasMany(() => ShipmentInspection, 'inventoryId')
  public inspections?: ShipmentInspection[];

  @HasMany(() => Income, 'inventoryId')
  public incomes?: Income[];

  @Field(() => Date)
  @CreatedAt
  public createdAt!: Date;

  @Field(() => Date)
  @UpdatedAt
  public updatedAt!: Date;

  @BeforeUpdate
  static async assignBin(instance: Inventory) {
    if (instance.changed('status')) {
      if (instance.status === InventoryStatus.INWAREHOUSE && !instance.bin) {
        const product = await Product.findByPk(instance.productId, {
          include: ['category'],
        });
        const user = await User.findByPk(instance.userId);
        const parentCategory = product.category
          ? (await getParentCategories(product.category)).pop()
          : null;

        const direction = product.demand > 30 ? 'DESC' : 'ASC';

        const bins: any = await Bin.findAll({
          group: ['Bin.id'],
          include: [
            {
              attributes: [],
              model: Inventory,
              duplicating: false,
              required: false,
            },
          ],
          attributes: {
            include: [
              [Sequelize.fn('COUNT', Sequelize.col('inventory.id')), 'count'],
            ],
          },
          order: [['location', direction]],
        });

        let bin = null;

        if (parentCategory && parentCategory.name === 'Lenses') {
          bin = bins.find((b) => Number(b.get('count')) < 3);
        } else {
          bin = bins.find((b) => Number(b.get('count')) === 0);
        }

        instance.binId = bin.id;

        const binName = `${bin.location}-${bin.row}-${bin.column}-${bin.cell}`;

        const body = {
          printerId: 69114235,
          title: 'License Plate Label for ' + instance.id,
          contentType: 'raw_base64',
          content: Buffer.from(
            `^XA

            ^FO24,48^BY0,0,0^BQN,2,7^FDMM, ${instance.id} ^FS
            
            ^FWR
            ^CF0,30
            ^FO150,260^FD ${product.name} ^FS
            ^CF0,30
            ^FO100,260^FD ${user.name} ^FS
            ^FO70,260^FD ${instance.serial} ^FS
            ^FO40,260^FD ${binName} ^FS
            
            ^XZ`,
          ).toString('base64'),
          source: 'Forest',
          expireAfter: 600,
          options: {},
        };

        const res = await fetch('https://api.printnode.com/printjobs', {
          method: 'post',
          body: JSON.stringify(body),
          headers: {
            'Content-Type': 'application/json',
            Authorization:
              'Basic ' +
              Buffer.from(
                '39duKfjG0etJ4YeQCk7WsHj2k_blwriaj9F-VPIBB5g',
              ).toString('base64'),
          },
        });

        console.log(res);
      } else {
        instance.binId = null;
      }
    }
  }

  @AfterUpdate
  @AfterCreate
  static async updateProductStock(instance: Inventory) {
    await internalQueue.add('update-product-stock', {
      productId: instance.productId,
    });
    await internalQueue.add('update-product-stats', {
      productId: instance.productId,
    });
  }
}
