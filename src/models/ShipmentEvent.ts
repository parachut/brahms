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
import { Field, ID, ObjectType } from 'type-graphql';

import { ShipmentStatus } from '../enums/shipmentStatus';
import { Shipment } from './Shipment';

@ObjectType()
@Table({
  tableName: 'shipment_event',
  underscored: true,
})
export class ShipmentEvent extends Model<ShipmentEvent> {
  @Field((type) => ID)
  @PrimaryKey
  @Default(Sequelize.literal('uuid_generate_v4()'))
  @Column(DataType.UUID)
  public id!: string;

  @Field()
  @Column
  public message!: string;

  @Field((type) => ShipmentStatus)
  @Default(ShipmentStatus.PRETRANSIT)
  @Column(
    DataType.ENUM({
      values: Object.values(ShipmentStatus),
    }),
  )
  public status!: ShipmentStatus;

  @Field()
  @Column
  public datetime!: Date;

  @Field()
  @Column
  public source!: string;

  @Column(DataType.GEOGRAPHY('POINT'))
  public coordinates: any;

  @ForeignKey(() => Shipment)
  @Column(DataType.UUID)
  public shipmentId!: string;

  @BelongsTo(() => Shipment)
  public shipment!: Shipment;

  @CreatedAt
  public createdAt!: Date;

  @UpdatedAt
  public updatedAt!: Date;
}
