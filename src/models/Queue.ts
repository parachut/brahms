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
import { Field, ID, ObjectType, Root } from 'type-graphql';

import { Product } from './Product';
import { User } from './User';

@ObjectType()
@Table
export class Queue extends Model<Queue> {
  @Field((type) => ID)
  @PrimaryKey
  @Default(Sequelize.literal('uuid_generate_v4()'))
  @Column(DataType.UUID)
  public id!: string;

  @Field({ nullable: true })
  @Column
  public lastNotified?: Date;

  @BelongsTo(() => Product)
  async product(@Root() queue: Queue): Promise<Product> {
    return Product.findByPk(queue.productId);
  }

  @ForeignKey(() => Product)
  @Column(DataType.UUID)
  public productId!: string;

  @BelongsTo(() => User)
  public user!: User;

  @ForeignKey(() => User)
  @Column(DataType.UUID)
  public userId!: string;

  @CreatedAt
  public createdAt!: Date;

  @UpdatedAt
  public updatedAt!: Date;
}
