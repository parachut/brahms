import Sequelize from 'sequelize';
import {
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
  UpdatedAt,
} from 'sequelize-typescript';
import { Field, ID, ObjectType } from 'type-graphql';

import { Category } from './Category';

@ObjectType()
@Table({
  tableName: 'category_inspection_tasks',
  underscored: true,
})
export class CategoryInspectionTask extends Model<CategoryInspectionTask> {
  @Field((type) => ID)
  @PrimaryKey
  @Default(Sequelize.literal('uuid_generate_v4()'))
  @Column(DataType.UUID)
  public id!: string;

  @Field()
  @Column
  public name!: string;

  @ForeignKey(() => Category)
  @Column(DataType.UUID)
  public categoryId!: string;

  @BelongsTo(() => Category)
  public category!: Category;

  @CreatedAt
  public createdAt!: Date;

  @UpdatedAt
  public updatedAt!: Date;
}
