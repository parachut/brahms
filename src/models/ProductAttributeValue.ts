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
  UpdatedAt,
} from 'sequelize-typescript';
import { Field, ID, ObjectType } from 'type-graphql';

import { Product } from './Product';
import { ProductAttribute } from './ProductAttribute';

@ObjectType()
@Table({
  tableName: 'product_attribute_values',
  underscored: true,
})
export class ProductAttributeValue extends Model<ProductAttributeValue> {
  @Field((type) => ID)
  @PrimaryKey
  @Default(Sequelize.literal('uuid_generate_v4()'))
  @Column(DataType.UUID)
  public id!: string;

  @Field()
  @Column
  public value!: string;

  @ForeignKey(() => Product)
  @Column(DataType.UUID)
  public productId!: string;

  @BelongsTo(() => Product)
  category: Product;

  @ForeignKey(() => ProductAttribute)
  @Column(DataType.UUID)
  public productAttributeId!: string;

  @BelongsTo(() => ProductAttribute)
  attribute: ProductAttribute;

  @CreatedAt
  public createdAt!: Date;

  @UpdatedAt
  public updatedAt!: Date;
}
