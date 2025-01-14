import Sequelize from 'sequelize';
import {
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
} from 'sequelize-typescript';
import { Field, ID, ObjectType } from 'type-graphql';

import { Address } from './Address';
import { CartInventory } from './CartInventory';
import { CartItem } from './CartItem';
import { Inventory } from './Inventory';
import { Shipment } from './Shipment';
import { User } from './User';

@ObjectType()
@Table({
  tableName: 'carts',
  underscored: true,
})
export class Cart extends Model<Cart> {
  /**
   * ID
   */
  @Field((type) => ID)
  @PrimaryKey
  @Default(Sequelize.literal('uuid_generate_v4()'))
  @Column(DataType.UUID)
  public id!: string;

  /**
   * Database Fields
   */
  @Field({ nullable: true })
  @Column
  public canceledAt?: Date;

  @Column
  public chargeId?: string;

  @Field({ nullable: true })
  @Column
  public completedAt?: Date;

  @Field({ nullable: true })
  @Column
  public confirmedAt?: Date;

  @Field({ nullable: true })
  @Column
  public planId?: string;

  @Field({ nullable: true })
  @Column
  public couponCode?: string;

  @Field()
  @Default(true)
  @Column
  public protectionPlan!: boolean;

  @Column
  public refundId?: string;

  @Field({ nullable: true })
  @Default('Ground')
  @Column
  public service!: string;

  /**
   * Database Relationships
   */
  @BelongsTo(() => User)
  public user!: User;

  @ForeignKey(() => User)
  @Column(DataType.UUID)
  public userId!: string;

  @BelongsTo(() => Address)
  public address?: Address;

  @ForeignKey(() => Address)
  @Column(DataType.UUID)
  public addressId?: string;

  @HasMany(() => CartItem, 'cartId')
  public items: CartItem[];

  @HasMany(() => Shipment, 'cartId')
  public shipments: Shipment[];

  @BelongsToMany(
    () => Inventory,
    () => CartInventory,
  )
  public inventory: Inventory[];

  @CreatedAt
  public createdAt!: Date;

  @UpdatedAt
  public updatedAt!: Date;
}
