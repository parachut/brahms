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
import { Field, ID, ObjectType, Root } from 'type-graphql';
import urlSlug from 'url-slug';

@ObjectType()
@Table
export class Category extends Model<Category> {
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

  @Field({ nullable: true })
  @Column
  public description?: string;

  @Field((type) => [String], { nullable: true })
  @Column(DataType.ARRAY(DataType.STRING(1024)))
  public includedEssentials?: string[];

  @Field((type) => Category, { nullable: true })
  @BelongsTo(() => Category)
  public parent?: Category;

  @ForeignKey(() => Category)
  @Column(DataType.UUID)
  public parentId!: string;

  @HasMany(() => Category, 'parentId')
  public children!: Category[];

  @CreatedAt
  public createdAt!: Date;

  @UpdatedAt
  public updatedAt!: Date;

  @BeforeCreate
  static createSlug(instance: Category) {
    instance.slug = urlSlug(instance.name);
  }
}
