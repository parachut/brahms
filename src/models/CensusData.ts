import Sequelize from 'sequelize';
import {
  Column,
  CreatedAt,
  DataType,
  Default,
  HasMany,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';

import { Address } from './Address';
import { CensusRangeBlock } from './CensusRangeBlock';

@Table
export class CensusData extends Model<CensusData> {
  @PrimaryKey
  @Default(Sequelize.literal('uuid_generate_v4()'))
  @Column(DataType.UUID)
  public id!: string;

  @Column
  public fips!: string;

  @Column
  public medianAge!: number;

  @Column
  public medianIncome!: number;

  @Column
  public medianHouseValue!: number;

  @Column
  public vacantHousing!: number;

  @Column
  public highSchoolGraduate!: number;

  @Column
  public someCollege!: number;

  @Column
  public collegeGraduate!: number;

  @Column
  public mastersGraduate!: number;

  @Column
  public professionalGraduate!: number;

  @Column
  public decorateGraduate!: number;

  @HasMany(() => CensusRangeBlock, 'censusDataAgeId')
  public ageRanges!: CensusRangeBlock[];

  @HasMany(() => CensusRangeBlock, 'censusDataIncomeId')
  public incomeRanges!: CensusRangeBlock[];

  @HasMany(() => Address, 'censusDataId')
  public addresses!: Address[];

  @CreatedAt
  public createdAt!: Date;
}
