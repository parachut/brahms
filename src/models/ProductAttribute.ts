import Sequelize from 'sequelize';
import {
  Column,
  CreatedAt,
  DataType,
  Default,
  HasMany,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt,
} from 'sequelize-typescript';
import { Field, ID, ObjectType } from 'type-graphql';

import { ProductAttributeValue } from './ProductAttributeValue';

@ObjectType()
@Table
export class ProductAttribute extends Model<ProductAttribute> {
  @Field((type) => ID)
  @PrimaryKey
  @Default(Sequelize.literal('uuid_generate_v4()'))
  @Column(DataType.UUID)
  public id!: string;

  @Field()
  @Column
  public name!: string;

  @HasMany(() => ProductAttributeValue, 'productAttributeId')
  public values?: ProductAttributeValue[];

  @CreatedAt
  public createdAt!: Date;

  @UpdatedAt
  public updatedAt!: Date;
}
