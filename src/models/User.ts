import Sequelize from 'sequelize';
import {
  AfterCreate,
  Column,
  CreatedAt,
  DataType,
  Default,
  DeletedAt,
  HasMany,
  Model,
  PrimaryKey,
  Table,
  Unique,
  UpdatedAt,
} from 'sequelize-typescript';
import { Field, ID, Int, ObjectType } from 'type-graphql';

import { UserRole } from '../enums/userRole';
import { UserStatus } from '../enums/userStatus';
import { createTask } from '../utils/createTask';
import { Address } from './Address';
import { Cart } from './Cart';
import { Income } from './Income';
import { Inventory } from './Inventory';
import { Invoice } from './Invoice';
import { Queue } from './Queue';
import { Shipment } from './Shipment';
import { UserGeolocation } from './UserGeolocation';
import { UserIntegration } from './UserIntegration';
import { UserMarketingSource } from './UserMarketingSource';
import { UserSocialHandle } from './UserSocialHandle';
import { UserVerification } from './UserVerification';

@ObjectType()
@Table
export class User extends Model<User> {
  @Field((type) => ID)
  @PrimaryKey
  @Default(Sequelize.literal('uuid_generate_v4()'))
  @Column(DataType.UUID)
  public id!: string;

  @Field()
  @Default(1)
  @Column
  public billingHour!: number;

  @Field({ nullable: true })
  @Column
  public businessName?: string;

  @Field((type) => Int)
  @Default(0)
  @Column
  public contributorStep!: number;

  @Field()
  @Unique
  @Column
  public email!: string;

  @Field({ nullable: true })
  @Column
  public location?: string;

  @Field()
  @Unique
  @Column
  public phone!: string;

  @Field()
  @Column
  public name!: string;

  @Field({ nullable: true })
  @Column
  public planId?: string;

  @Field((type) => Int)
  @Default(0)
  @Column
  public points!: number;

  @Field((type) => [UserRole])
  @Default([UserRole.MEMBER])
  @Column(
    DataType.ARRAY(
      DataType.ENUM({
        values: Object.values(UserRole),
      }),
    ),
  )
  public roles!: UserRole[];

  @Field((type) => UserStatus)
  @Default(UserStatus.APPROVED)
  @Column(
    DataType.ENUM({
      values: Object.values(UserStatus),
    }),
  )
  public status!: UserStatus;

  @Column
  public stripeId?: string;

  @HasMany(() => Cart, 'userId')
  public carts!: Cart[];

  @HasMany(() => Address, 'userId')
  public addresses!: Address[];

  @HasMany(() => Income, 'userId')
  public incomes!: Income[];

  @HasMany(() => Income, 'memberId')
  public linkedIncomes!: Income[];

  @HasMany(() => UserIntegration, 'userId')
  public integrations!: UserIntegration[];

  @HasMany(() => UserVerification, 'userId')
  public verifications!: UserVerification[];

  @HasMany(() => UserMarketingSource, 'userId')
  public marketingSources!: UserMarketingSource[];

  @HasMany(() => UserSocialHandle, 'userId')
  public socialHandles!: UserSocialHandle[];

  @HasMany(() => UserGeolocation, 'userId')
  public geolocations!: UserGeolocation[];

  @Field((type) => [Inventory])
  @HasMany(() => Inventory, 'memberId')
  currentInventory: Inventory[];

  @Field((type) => [Inventory])
  @HasMany(() => Inventory, 'userId')
  inventory: Inventory[];

  @HasMany(() => Invoice, 'userId')
  public invoices!: Invoice[];

  @HasMany(() => Queue, 'userId')
  public queues?: Queue[];

  @HasMany(() => Shipment, 'userId')
  public shipments?: Shipment[];

  @CreatedAt
  public createdAt!: Date;

  @UpdatedAt
  public updatedAt?: Date;

  @DeletedAt
  public deletedAt?: Date;

  @AfterCreate
  static async linkAccounts(instance: User) {
    if (!instance.stripeId) {
      await Promise.all([
        createTask('create-stripe-user', {
          userId: instance.get('id'),
        }),
        createTask('create-authy-user', {
          userId: instance.get('id'),
        }),
        createTask('create-front-contact', {
          userId: instance.get('id'),
        }),
      ]);
    }
  }
}
