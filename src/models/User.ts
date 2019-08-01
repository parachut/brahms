import Sequelize from 'sequelize';
import {
  AfterCreate,
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
import uuid from 'uuid/v4';
import { Field, ID, Int, ObjectType } from 'type-graphql';

import { UserRole } from '../enums/userRole';
import { UserStatus } from '../enums/userStatus';
import { createStripeUser } from '../utils/createStripeUser';
import { Address } from './Address';
import { Cart } from './Cart';
import { Income } from './Income';
import { Inventory } from './Inventory';
import { Invoice } from './Invoice';
import { Queue } from './Queue';
import { Shipment } from './Shipment';
import { UserIntegration } from './UserIntegration';
import { UserVerification } from './UserVerification';
import { UserMarketingSource } from './UserMarketingSource';
import { UserSocialHandle } from './UserSocialHandle';

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

  @Unique
  @Default(Sequelize.literal('uuid_generate_v4()'))
  @Column
  public stripeId!: string;

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

  @Field((type) => [Inventory])
  @HasMany(() => Inventory, { foreignKey: 'memberId' })
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
  static async createStripeUser(instance: User) {
    if (!instance.stripeId) {
      console.log(instance);
      const stripeIntegration = await createStripeUser(instance);

      return Promise.all([
        UserIntegration.create(stripeIntegration),
        User.update(
          { stripeId: stripeIntegration.value },
          { where: { id: instance.id } },
        ),
      ]);
    }
  }

  /**
  @AfterCreate
  static async createAuthyUser(instance: User) {
    const authyIntegration = await createAuthyUser(instance);
    return UserIntegration.create(authyIntegration);
  }

  @AfterCreate
  static async createFrontContact(instance: User) {
    const frontIntegration = await createFrontContact(instance);
    return UserIntegration.create(frontIntegration);
  }

   */
}
