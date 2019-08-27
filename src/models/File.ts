import Sequelize from 'sequelize';
import {
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  Default,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
  Unique,
  UpdatedAt,
} from 'sequelize-typescript';
import { Field, ID, ObjectType } from 'type-graphql';

import { Brand } from './Brand';
import { Product } from './Product';
import { ShipmentInspection } from './ShipmentInspection';

@ObjectType()
@Table
export class File extends Model<File> {
  @Field((type) => ID)
  @PrimaryKey
  @Default(Sequelize.literal('uuid_generate_v4()'))
  @Column(DataType.UUID)
  public id!: string;

  @Field()
  @Unique
  @Column
  public filename!: string;

  @Field()
  @Column
  public contentType!: string;

  @Field({ nullable: true })
  @Column
  public name?: string;

  @Field({ nullable: true })
  @Column
  public description?: string;

  @BelongsTo(() => Brand, 'brandId')
  public brand?: Brand;

  @ForeignKey(() => Brand)
  @Column(DataType.UUID)
  public brandId?: string;

  @BelongsTo(() => Product, 'productId')
  public product?: Product;

  @ForeignKey(() => Product)
  @Column(DataType.UUID)
  public productId?: string;

  @BelongsTo(() => ShipmentInspection, 'shipmentInspectionId')
  public shipmentInspection?: ShipmentInspection;

  @ForeignKey(() => ShipmentInspection)
  @Column(DataType.UUID)
  public shipmentInspectionId?: string;

  @CreatedAt
  public createdAt!: Date;

  @UpdatedAt
  public updatedAt!: Date;
}
