import EasyPost from '@easypost/api';
import Geocodio from 'geocodio';
import omit from 'lodash/omit';
import Sequelize from 'sequelize';
import {
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
  AfterCreate,
} from 'sequelize-typescript';
import { Field, ID, ObjectType } from 'type-graphql';
import util from 'util';

import { Cart } from './Cart';
import { CensusData } from './CensusData';
import { Shipment } from './Shipment';
import { User } from './User';
import { createTask } from '../utils/createTask';

const easyPost = new EasyPost(process.env.EASYPOST);
const geocodio = new Geocodio({
  api_key: process.env.GEOCODIO,
});

const geocodioPromise = util.promisify(geocodio.get).bind(geocodio);

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
  public censusData!: CensusData;

  @ForeignKey(() => CensusData)
  @Column(DataType.UUID)
  public cesusDataId!: string;

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

    instance.phone = instance.phone || user.phone;
    instance.email = instance.email || user.email;
    instance.country = instance.country || 'US';

    const q = `${instance.street} ${instance.secondaryUnit} ${instance.city} ${instance.state} ${instance.zip}`;

    const res = await geocodioPromise('geocode', { q });
    const { results } = JSON.parse(res);

    const [result] = results;

    Object.assign(
      instance,
      omit(result.address_components, [
        'formatted_street',
        'secondaryunit',
        'secondarynumber',
      ]),
    );
    instance.formattedStreet = result.address_components.formatted_street;
    instance.formattedAddress = result.formatted_address;
    instance.secondaryUnit = result.address_components.secondaryunit;
    instance.secondaryNumber = result.address_components.secondarynumber;
    instance.coordinates = {
      type: 'Point',
      coordinates: [result.location.lat, result.location.lng],
    };
  }

  @AfterCreate
  static async createEasyPostId(instance: Address) {
    await createTask('create-easypost-address', {
      addressId: instance.get('id'),
    });
  }
}
