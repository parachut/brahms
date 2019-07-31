import EasyPost from '@easypost/api';
import pMap from 'p-map';
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
import { Ctx, Field, ID, Int, ObjectType, Root } from 'type-graphql';

import { CartTransitTime } from '../classes/cartTransitTime';
import { IContext } from '../utils/context.interface';
import { Address } from './Address';
import { CartItem } from './CartItem';
import { CartInventory } from './CartInventory';
import { Inventory } from './Inventory';
import { User } from './User';
import { Warehouse } from './Warehouse';

const moment = require('moment-business-days');
const easyPost = new EasyPost(process.env.EASYPOST);

@ObjectType()
@Table
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
  address: Address;

  @ForeignKey(() => Address)
  @Column(DataType.UUID)
  public addressId!: string;

  @HasMany(() => CartItem, 'cartId')
  items: CartItem[];

  @BelongsToMany(() => Inventory, () => CartInventory)
  inventory: Inventory[];

  @CreatedAt
  public createdAt!: Date;

  @UpdatedAt
  public updatedAt!: Date;
}
