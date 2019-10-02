import nameParser from 'another-name-parser';
import Sequelize from 'sequelize';
import {
  AfterCreate,
  AfterUpdate,
  BeforeCreate,
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
import { createQueue } from '../redis';
import { Address } from './Address';
import { Cart } from './Cart';
import { Deposit } from './Deposit';
import { Income } from './Income';
import { Inventory } from './Inventory';
import { Queue } from './Queue';
import { Shipment } from './Shipment';
import { UserGeolocation } from './UserGeolocation';
import { UserIntegration } from './UserIntegration';
import { UserMarketingSource } from './UserMarketingSource';
import { UserSocialHandle } from './UserSocialHandle';
import { UserVerification } from './UserVerification';

const integrationQueue = createQueue('integration-queue');

@ObjectType()
@Table({
  tableName: 'user',
  underscored: true,
})
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

  @Field((type) => Int)
  @Default(1)
  @Column(DataType.SMALLINT)
  public billingHour!: number;

  @Field((type) => Int, { nullable: true })
  @Column(DataType.SMALLINT)
  public billingDay?: number;

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

  @Column(DataType.JSONB)
  public parsedName?: any;

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

  @Field()
  @Column
  public site?: string;

  @Field()
  @Column
  public stripeId?: string;

  @Field()
  @Default(false)
  @Column
  public protectionPlan!: boolean;

  @Field()
  @Default(false)
  @Column
  public vip!: boolean;

  @HasMany(() => Cart, 'userId')
  public carts!: Cart[];

  @HasMany(() => Address, 'userId')
  public addresses!: Address[];

  @HasMany(() => Deposit, 'userId')
  public deposit!: Deposit[];

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

  @BeforeCreate
  static parseName(instance: User) {
    instance.parsedName = nameParser(instance.name);
  }

  @AfterCreate
  static async linkAccounts(instance: User) {
    integrationQueue.add('create-recurly-user', {
      userId: instance.get('id'),
    });
    integrationQueue.add('create-authy-user', {
      userId: instance.get('id'),
    });
    integrationQueue.add('create-front-contact', {
      userId: instance.get('id'),
    });
    integrationQueue.add('check-clearbit', {
      userId: instance.get('id'),
    });
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
      integrationQueue.add('create-authy-user', {
        userId: instance.get('id'),
      });
    }
  }
}
