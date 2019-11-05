import Sequelize from 'sequelize';
import {
  Column,
  DataType,
  Default,
  ForeignKey,
  Model,
  PrimaryKey,
  CreatedAt,
  UpdatedAt,
  Table,
} from 'sequelize-typescript';
import { Field, ID } from 'type-graphql';

import { CategoryInspectionTask } from './CategoryInspectionTask';
import { ShipmentInspection } from './ShipmentInspection';

@Table({
  tableName: 'shipment_inspection_tasks',
  underscored: true,
})
export class ShipmentInspectionTask extends Model<ShipmentInspectionTask> {
  @Field((type) => ID)
  @PrimaryKey
  @Default(Sequelize.literal('uuid_generate_v4()'))
  @Column(DataType.UUID)
  public id!: string;

  @ForeignKey(() => CategoryInspectionTask)
  @Column(DataType.UUID)
  public categoryInspectionTaskId!: string;

  @ForeignKey(() => ShipmentInspection)
  @Column(DataType.UUID)
  public shipmentInspectionId!: string;

  @Column(DataType.BOOLEAN)
  public complete!: boolean;

  @Column(DataType.TEXT)
  public notes?: string;

  @CreatedAt
  public createdAt!: Date;

  @UpdatedAt
  public updatedAt!: Date;
}
