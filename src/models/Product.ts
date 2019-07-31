import Sequelize from 'sequelize';
import {
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
import { Field, ID, Int, ObjectType, Root } from 'type-graphql';
import urlSlug from 'url-slug';

import { Brand } from './Brand';
import { Category } from './Category';
import { File } from './File';
import { Inventory } from './Inventory';
import { Queue } from './Queue';

@ObjectType()
@Table
export class Product extends Model<Product> {
  @Field((type) => ID)
  @PrimaryKey
  @Default(Sequelize.literal('uuid_generate_v4()'))
  @Column(DataType.UUID)
  public id!: string;

  @Default(true)
  @Column
  public active!: boolean;

  @Column('Float')
  public depth?: number;

  @Field({ nullable: true })
  @Column(DataType.TEXT)
  public description?: string;

  @Field((type) => [String], { nullable: true })
  @Column(DataType.ARRAY(DataType.STRING(1024)))
  public features?: string[];

  @Column('Float')
  public height?: number;

  @Field((type) => [String], { nullable: true })
  @Column(DataType.ARRAY(DataType.STRING(1024)))
  public images?: string[];

  @Field((type) => [String], { nullable: true })
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
  @Column('Int')
  public points!: number;

  @Field((type) => Int)
  @Default(0)
  @Column('Int')
  public popularity!: number;

  @Field((type) => Int, { nullable: true })
  @Column('Int')
  public shippingWeight?: number;

  @Field()
  @Column
  public slug!: string;

  @Field((type) => Int)
  @Default(0)
  @Column('Int')
  public stock!: number;

  @Column('Int')
  public weight?: number;

  @Column('Int')
  public width?: number;

  @HasMany(() => File, 'productId')
  public files?: File[];

  @HasMany(() => Inventory, 'productId')
  public inventory?: Inventory[];

  @HasMany(() => Queue, 'productId')
  public queues?: Queue[];

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
  public categoryId!: string;

  @CreatedAt
  public createdAt!: Date;

  @UpdatedAt
  public updatedAt!: Date;

  @BeforeCreate
  static createSlug(instance: Product) {
    instance.slug = urlSlug(instance.name);
  }
}
