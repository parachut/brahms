import BullQueue from 'bull';
import Sequelize from 'sequelize';
import {
  AfterCreate,
  AfterUpdate,
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

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const createAuthyUserQueue = new BullQueue('create-authy-user', REDIS_URL);
const createFrontContactQueue = new BullQueue(
  'create-front-contact',
  REDIS_URL,
);
const createStripeUserQueue = new BullQueue('create-stripe-user', REDIS_URL);
const runClearbitQueue = new BullQueue('run-clearbit', REDIS_URL);

@ObjectType()
@Table
export class User extends Model<User> {
  @Field((type) => ID)
  @PrimaryKey
  @Default(Sequelize.literal('uuid_generate_v4()'))
  @Column(DataType.UUID)
  public id!: string;

  @Field({ nullable: true })
  @Column
  public avatar?: string;

  @Field({ nullable: true })
  @Column
  public bio?: string;

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

  @Field({ nullable: true })
  @Column
  public site?: string;

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
  static linkAccounts(instance: User) {
    if (!instance.stripeId) {
      createStripeUserQueue.add({
        userId: instance.get('id'),
      });
      createAuthyUserQueue.add({
        userId: instance.get('id'),
      });
      createFrontContactQueue.add({
        userId: instance.get('id'),
      });
      runClearbitQueue.add({
        userId: instance.get('id'),
      });
    }
  }

  @AfterUpdate
  static async updateAuthy(instance: User) {
    if (instance.changed('phone')) {
      await UserIntegration.destroy({
        where: {
          userId: instance.id,
          type: 'AUTHY',
        },
      });
      createAuthyUserQueue.add({
        userId: instance.get('id'),
      });
    }
  }
}
