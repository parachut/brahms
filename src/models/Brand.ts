import Sequelize from 'sequelize';
import {
  BeforeCreate,
  Column,
  CreatedAt,
  DataType,
  Default,
  HasOne,
  Model,
  PrimaryKey,
  Table,
  Unique,
  UpdatedAt,
} from 'sequelize-typescript';
import { Field, ID, ObjectType } from 'type-graphql';
import urlSlug from 'url-slug';

import { File } from './File';

@ObjectType()
@Table({
  tableName: 'brand',
  underscored: true,
})
export class Brand extends Model<Brand> {
  @Field((type) => ID)
  @PrimaryKey
  @Default(Sequelize.literal('uuid_generate_v4()'))
  @Column(DataType.UUID)
  public id!: string;

  @Field({ nullable: true })
  @Column
  public logo?: string;

  @Field()
  @Unique
  @Column
  public name!: string;

  @Field()
  @Unique
  @Column
  public slug!: string;

  @Field()
  @Column
  public url?: string;

  @HasOne(() => File, 'brandId')
  public file?: File;

  @CreatedAt
  public createdAt!: Date;

  @UpdatedAt
  public updatedAt!: Date;

  @BeforeCreate
  static createSlug(instance: Brand) {
    instance.slug = urlSlug(instance.name);
  }
}
