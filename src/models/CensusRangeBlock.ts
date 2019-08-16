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

import { CensusData } from './CensusData';

@Table
export class CensusRangeBlock extends Model<CensusRangeBlock> {
  @PrimaryKey
  @Default(Sequelize.literal('uuid_generate_v4()'))
  @Column(DataType.UUID)
  public id!: string;

  @Column(DataType.RANGE(DataType.INTEGER))
  public range!: [number];

  @Column(DataType.FLOAT)
  public value!: number;

  @Column(DataType.GEOGRAPHY('POINT'))
  public coordinates: any;

  @BelongsTo(() => CensusData)
  censusDataAge?: CensusData;

  @ForeignKey(() => CensusData)
  @Column(DataType.UUID)
  censusDataAgeId?: string;

  @BelongsTo(() => CensusData)
  censusDataIncome?: CensusData;

  @ForeignKey(() => CensusData)
  @Column(DataType.UUID)
  censusDataIncomeId?: string;

  @CreatedAt
  public createdAt!: Date;
}
