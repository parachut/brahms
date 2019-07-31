import EasyPost from '@easypost/api';
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
} from 'sequelize-typescript';
import { Field, ID, ObjectType } from 'type-graphql';

import { AddressFormatted } from '../classes/addressFormatted.object';
import { Cart } from './Cart';
import { Shipment } from './Shipment';
import { User } from './User';

const easyPost = new EasyPost(process.env.EASYPOST);

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
  public city!: string;

  @Field()
  @Column
  public country!: string;

  @Column
  public easyPostId?: string;

  @Field()
  @Column
  public email!: string;

  @Field((type) => AddressFormatted)
  get formatted(): AddressFormatted | null {
    return {
      line1: this.street1 + (this.street2 ? ' ' + this.street2 : ''),
      line2: this.city + ', ' + this.state + ' ' + this.zip,
    };
  }

  @Field()
  @Column
  public phone!: string;

  @Field()
  @Default(false)
  @Column
  public primary!: boolean;

  @Field()
  @Default(true)
  @Column
  public residential!: boolean;

  @Field()
  @Column
  public state!: string;

  @Field()
  @Column
  public street1!: string;

  @Field({ nullable: true })
  @Column
  public street2?: string;

  @Column(DataType.GEOGRAPHY('POINT'))
  public coordinates: any;

  @Field()
  @Column
  public zip!: string;

  @BelongsTo(() => User)
  public user!: User;

  @ForeignKey(() => User)
  @Column(DataType.UUID)
  public userId!: string;

  @HasMany(() => Shipment, 'addressId')
  public shipments?: Shipment[];

  @HasMany(() => Cart, 'cartId')
  public carts?: Cart[];

  @CreatedAt
  public createdAt!: Date;

  @DeletedAt
  public deletedAt?: Date;

  @BeforeCreate
  static async createEasyPostId(instance: Address) {
    const user = await User.findByPk(instance.userId);

    instance.phone = instance.phone || user.phone;
    instance.email = instance.email || user.email;
    instance.country = instance.country || 'US';

    const easyPostAddress = new easyPost.Address({
      city: instance.city,
      country: instance.country,
      email: instance.email,
      phone: instance.phone,
      state: instance.state,
      street1: instance.street1,
      street2: instance.street2,
      verify: ['delivery'],
      zip: instance.zip,
    });
    await easyPostAddress.save();

    if (easyPostAddress.verifications.delivery.success === false) {
      throw new Error('Address not found.');
    }

    if (
      easyPostAddress.verifications.delivery &&
      easyPostAddress.verifications.delivery.details
    ) {
      const { details } = easyPostAddress.verifications.delivery;
      const point = {
        type: 'Point',
        coordinates: [details.longitude, details.latitude],
      };
      instance.coordinates = point;
    }

    instance.residential = easyPostAddress.residential;
    instance.zip = easyPostAddress.zip;
    instance.easyPostId = easyPostAddress.id;
  }
}
