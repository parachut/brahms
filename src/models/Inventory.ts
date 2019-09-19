import Sequelize from 'sequelize';
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
import { Shipment } from './Shipment';
import { ShipmentInspection } from './ShipmentInspection';
import { ShipmentInventory } from './ShipmentInventory';
import { User } from './User';
import { Warehouse } from './Warehouse';
import { createQueue } from '../redis';
import { getParentCategories } from '../utils/getParentCategories';

const internalQueue = createQueue('internal-queue');

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

  @BelongsToMany(() => Shipment, () => ShipmentInventory)
  shipments: Shipment[];

  @BelongsToMany(() => Cart, () => CartInventory)
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

  @CreatedAt
  public createdAt!: Date;

  @UpdatedAt
  public updatedAt!: Date;

  @BeforeUpdate
  static async assignBin(instance: Inventory) {
    if (instance.changed('status')) {
      if (instance.status === InventoryStatus.INWAREHOUSE) {
        const product = await Product.findByPk(instance.productId, {
          include: ['category'],
        });
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

        if (parentCategory && parentCategory.name === 'Lenses') {
          console.log(bins[0].get('count'));
          instance.binId = bins.find((b) => Number(b.get('count')) < 3).id;
        } else {
          instance.binId = bins.find((b) => Number(b.get('count')) === 0).id;
        }
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
