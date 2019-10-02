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
} from 'sequelize-typescript';

import { User } from './User';

@Table({
  tableName: 'user_geolocation',
  underscored: true,
})
export class UserGeolocation extends Model<UserGeolocation> {
  @PrimaryKey
  @Default(Sequelize.literal('uuid_generate_v4()'))
  @Column(DataType.UUID)
  public id!: string;

  @Column(DataType.CIDR)
  public ip!: string;

  @Column
  public type!: string;

  @Column
  public countryCode!: string;

  @Column
  public regionCode?: string;

  @Column
  public city?: string;

  @Column
  public zip?: string;

  @Column(DataType.GEOGRAPHY('POINT'))
  public coordinates: any;

  @BelongsTo(() => User)
  user!: User;

  @ForeignKey(() => User)
  @Column(DataType.UUID)
  userId!: string;

  @CreatedAt
  public createdAt!: Date;
}
