import Sequelize from 'sequelize';
import {
  BeforeCreate,
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
import { Field, ID, Int, ObjectType } from 'type-graphql';

import { Cart } from './Cart';
import { Product } from './Product';

@ObjectType()
@Table({
  tableName: 'cart_items',
  underscored: true,
})
export class CartItem extends Model<CartItem> {
  @Field((type) => ID)
  @PrimaryKey
  @Default(Sequelize.literal('uuid_generate_v4()'))
  @Column(DataType.UUID)
  public id!: string;

  @Field((type) => Int)
  @Default(0)
  @Column
  public points!: number;

  @Field((type) => Int)
  @Default(0)
  @Column
  public quantity!: number;

  @BelongsTo(() => Cart)
  public cart!: Cart;

  @ForeignKey(() => Cart)
  @Column(DataType.UUID)
  public cartId!: string;

  @BelongsTo(() => Product)
  product: Product;

  @ForeignKey(() => Product)
  @Column(DataType.UUID)
  public productId!: string;

  @CreatedAt
  public createdAt!: Date;

  @UpdatedAt
  public updatedAt!: Date;

  @BeforeCreate
  static async setPoints(instance: CartItem) {
    const product = await Product.findByPk(instance.productId);

    instance.points = product.points;
    instance.quantity = instance.quantity || 1;
  }
}
