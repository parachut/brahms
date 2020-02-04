import Sequelize from 'sequelize';
import {
  BelongsToMany,
  Column,
  Model,
  PrimaryKey,
  Table,
  Default,
  DataType,
  ForeignKey,
  BelongsTo,
  CreatedAt,
  UpdatedAt,
} from 'sequelize-typescript';
import { Field, ID, ObjectType } from 'type-graphql';

import { Product } from './Product';
import { InventoryCondition } from '../enums/inventoryCondition';

@ObjectType()
@Table({
  tableName: 'product_values',
  underscored: true,
})
export class ProductValue extends Model<ProductValue> {
  @Field((type) => ID)
  @PrimaryKey
  @Default(Sequelize.literal('uuid_generate_v4()'))
  @Column(DataType.UUID)
  public id!: string;

  @Field()
  @Column
  value!: string;

  @BelongsTo(() => Product)
  product: Product;

  @ForeignKey(() => Product)
  @Column(DataType.UUID)
  public productId!: string;

  @Field((type) => InventoryCondition)
  @Default(InventoryCondition.NEW)
  @Column(
    DataType.ENUM({
      values: Object.values(InventoryCondition),
    }),
  )
  public condition!: InventoryCondition;

  @Field()
  @Column
  source!: string;

  @Field(() => Date)
  @CreatedAt
  public createdAt!: Date;

  @Field(() => Date)
  @UpdatedAt
  public updatedAt!: Date;
}
