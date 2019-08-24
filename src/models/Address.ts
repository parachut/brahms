import Queue from 'bull';
import Sequelize from 'sequelize';
import {
  AfterCreate,
  BeforeCreate,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  Default,
  DeletedAt,
  ForeignKey,
  HasMany,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { Field, ID, ObjectType } from 'type-graphql';

import { Cart } from './Cart';
import { CensusData } from './CensusData';
import { Shipment } from './Shipment';
import { User } from './User';
import { createQueue } from '../redis';

const integrationQueue = createQueue('integration-queue');

@ObjectType()
@Table
export class Address extends Model<Address> {
  @Field((type) => ID)
  @PrimaryKey
  @Default(Sequelize.literal('uuid_generate_v4()'))
  @Column(DataType.UUID)
  public id!: string;

  @Field()
  @Column
  public name!: string;

  @Field()
  @Column
  public number!: string;

  @Field({ nullable: true })
  @Column
  public predirectional?: string;

  @Field()
  @Column
  public prefix!: string;

  @Field()
  @Column
  public street!: string;

  @Field()
  @Column
  public suffix!: string;

  @Field({ nullable: true })
  @Column
  public postdirectional?: string;

  @Field({ nullable: true })
  @Column
  public secondaryUnit?: string;

  @Field({ nullable: true })
  @Column
  public secondaryNumber?: string;

  @Field()
  @Column
  public city!: string;

  @Field({ nullable: true })
  @Column
  public county?: string;

  @Field({ nullable: true })
  @Column
  public state?: string;

  @Field()
  @Column
  public zip!: string;

  @Field()
  @Column
  public country!: string;

  @Field()
  @Column
  public formattedStreet!: string;

  @Field()
  @Column
  public formattedAddress!: string;

  @Field({ nullable: true })
  @Column
  public phone?: string;

  @Field({ nullable: true })
  @Column
  public email?: string;

  @Field()
  @Default(true)
  @Column
  public residential!: boolean;

  @Field()
  @Default(true)
  @Column
  public primary!: boolean;

  @Field()
  @Default(true)
  @Column
  public billing!: boolean;

  @Field({ nullable: true })
  @Column
  public easyPostId?: string;

  @Column(DataType.GEOGRAPHY('POINT'))
  public coordinates: any;

  @BelongsTo(() => User)
  public user!: User;

  @ForeignKey(() => User)
  @Column(DataType.UUID)
  public userId!: string;

  @BelongsTo(() => CensusData)
  public censusData?: CensusData;

  @ForeignKey(() => CensusData)
  @Column(DataType.UUID)
  public censusDataId?: string;

  @HasMany(() => Shipment, 'addressId')
  public shipments?: Shipment[];

  @HasMany(() => Cart, 'cartId')
  public carts?: Cart[];

  @CreatedAt
  public createdAt!: Date;

  @DeletedAt
  public deletedAt?: Date;

  @BeforeCreate
  static async normalize(instance: Address) {
    const user = await User.findByPk(instance.userId);
    if (instance.primary) {
      await Address.update(
        {
          primary: false,
        },
        {
          where: {
            userId: instance.userId,
          },
        },
      );
    }
    instance.country = instance.country || 'US';
    instance.email = user.email;
    instance.phone = user.phone;
    instance.name = user.name;
    instance.formattedStreet = instance.street;
    instance.formattedAddress = `${instance.street}, ${instance.city}, ${instance.state} ${instance.zip}`;
  }

  @AfterCreate
  static async createEasyPostId(instance: Address) {
    integrationQueue.add('create-easypost-address', {
      addressId: instance.get('id'),
    });
    integrationQueue.add('update-address-census-data', {
      addressId: instance.get('id'),
    });
  }
}
