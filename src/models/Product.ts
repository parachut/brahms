import algoliasearch from 'algoliasearch';
import Sequelize from 'sequelize';
import {
  AfterCreate,
  AfterUpdate,
  AfterBulkUpdate,
  BeforeCreate,
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
  Unique,
  UpdatedAt,
} from 'sequelize-typescript';
import { Field, ID, Int, ObjectType } from 'type-graphql';
import urlSlug from 'url-slug';

import { Brand } from './Brand';
import { Category } from './Category';
import { File } from './File';
import { Inventory } from './Inventory';
import { ProductAttributeValue } from './ProductAttributeValue';
import { Queue } from './Queue';
import { formatAlgoliaProduct } from '../utils/formatAlgoliaProduct';

const client = algoliasearch(
  process.env.ALGOLIA_APPID,
  process.env.ALGOLIA_SECRET,
);

const index = client.initIndex('prod_Products');

@ObjectType()
@Table({
  tableName: 'products',
  underscored: true,
})
export class Product extends Model<Product> {
  @Field((type) => ID)
  @PrimaryKey
  @Default(Sequelize.literal('uuid_generate_v4()'))
  @Column(DataType.UUID)
  public id!: string;

  @Default(true)
  @Column
  public active!: boolean;

  @Column(DataType.FLOAT)
  public length?: number;

  @Field({ nullable: true })
  @Column(DataType.TEXT)
  public description?: string;

  @Field((type) => [String], { nullable: true })
  @Column(DataType.ARRAY(DataType.STRING(1024)))
  public features?: string[];

  @Column(DataType.FLOAT)
  public height?: number;

  @Field((type) => [String])
  @Default([])
  @Column(DataType.ARRAY(DataType.STRING(1024)))
  public images?: string[];

  @Field((type) => [String])
  @Default([])
  @Column(DataType.ARRAY(DataType.STRING(1024)))
  public inTheBox?: string[];

  @Default(new Date())
  @Column
  public lastInventoryCreated!: Date;

  @Field({ nullable: true })
  @Column
  public mfr?: string;

  @Field()
  @Unique
  @Column
  public name!: string;

  @Field((type) => Int)
  @Default(0)
  @Column
  public points!: number;

  @Field((type) => Int)
  @Default(0)
  @Column
  public popularity!: number;

  @Field((type) => Int, { nullable: true })
  @Column
  public shippingWeight?: number;

  @Field()
  @Column
  public slug!: string;

  @Field((type) => Int)
  @Default(0)
  @Column
  public stock!: number;

  @Field((type) => Int)
  @Default(0)
  @Column
  public demand!: number;

  @Column
  public weight?: number;

  @Column
  public width?: number;

  @HasMany(() => File, 'productId')
  public files?: File[];

  @HasMany(() => Inventory, 'productId')
  public inventory?: Inventory[];

  @HasMany(() => Queue, 'productId')
  public queues?: Queue[];

  @HasMany(() => ProductAttributeValue, 'productId')
  public attributesValues?: ProductAttributeValue[];

  @Field((type) => Brand)
  @BelongsTo(() => Brand)
  brand: Brand;

  @ForeignKey(() => Brand)
  @Column(DataType.UUID)
  public brandId!: string;

  @BelongsTo(() => Category)
  category: Category;

  @ForeignKey(() => Category)
  @Column(DataType.UUID)
  public categoryId?: string;

  @CreatedAt
  public createdAt!: Date;

  @UpdatedAt
  public updatedAt!: Date;

  @BeforeCreate
  static createSlug(instance: Product) {
    instance.slug = urlSlug(instance.name);
  }

  @AfterCreate
  static async createAlgolia(instance: Product) {
    // const record = await formatAlgoliaProduct(instance);
    // await index.addObjects(record);
  }

  @AfterUpdate
  @AfterBulkUpdate
  static async updateAlgolia(instance: Product) {
    //const record = await formatAlgoliaProduct(instance);
    // await index.saveObjects(record);
  }
}
