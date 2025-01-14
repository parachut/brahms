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
import { Address } from './Address';
import { Cart } from './Cart';
import { Deposit } from './Deposit';
import { Income } from './Income';
import { Inventory } from './Inventory';
import { Queue } from './Queue';
import { ShipKit } from './ShipKit';
import { Shipment } from './Shipment';
import { UserBankAccount } from './UserBankAccount';
import { UserGeolocation } from './UserGeolocation';
import { UserIntegration } from './UserIntegration';
import { UserMarketingSource } from './UserMarketingSource';
import { UserSocialHandle } from './UserSocialHandle';
import { UserTermAgreement } from './UserTermAgreement';
import { UserVerification } from './UserVerification';
import { createAuthyUser } from '../utils/createAuthyUser';
import { createRecurlyUser } from '../utils/createRecurlyUser';
import { createFrontContact } from '../utils/createFrontContact';
import checkClearbit from '../utils/checkClearbit';

@ObjectType()
@Table({
  tableName: 'users',
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

  @Field({ nullable: true })
  @Column
  public legacyPlan?: string;

  @Field({ nullable: true })
  @Column
  public additionalItems?: number;

  @Field()
  @Default(false)
  @Column
  public vip!: boolean;

  @HasMany(() => Cart, 'userId')
  public carts!: Cart[];

  @HasMany(() => Address, 'userId')
  public addresses!: Address[];

  @HasMany(() => Deposit, 'userId')
  public deposits!: Deposit[];

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

  @HasMany(() => ShipKit, 'userId')
  public shipKits?: ShipKit[];

  @HasMany(() => Shipment, 'userId')
  public shipments?: Shipment[];

  @HasMany(() => UserBankAccount, 'userId')
  public bankAccounts?: UserBankAccount[];

  @HasMany(() => UserTermAgreement, 'userId')
  public termAgreements?: UserTermAgreement[];

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
    const integrations = await Promise.all([
      createAuthyUser(instance),
      createRecurlyUser(instance),
      createFrontContact(instance),
    ]);
    await Promise.all([
      UserIntegration.bulkCreate(integrations),
      checkClearbit(instance),
    ]);
  }

  @AfterUpdate
  static async updateAuthy(instance: User) {
    if (instance.changed('phone')) {
      const newAuthy = await createAuthyUser(instance);
      await Promise.all([
        UserIntegration.destroy({
          where: {
            userId: instance.id,
            type: 'AUTHY',
          },
        }),
        UserIntegration.create(newAuthy),
      ]);
    }
  }
}
