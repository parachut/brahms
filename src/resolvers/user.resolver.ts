import crypto from 'crypto';
import { Op } from 'sequelize';
import {
  Arg,
  Authorized,
  Ctx,
  FieldResolver,
  Mutation,
  Resolver,
  Root,
} from 'type-graphql';

import { InventoryStatus } from '../enums/inventoryStatus';
import { Inventory } from '../models/Inventory';
import { Income } from '../models/Income';
import { Deposit } from '../models/Deposit';
import { User } from '../models/User';
import { UserVerification } from '../models/UserVerification';
import { UserRole } from '../enums/userRole';
import { IContext } from '../utils/context.interface';
import { UserUpdateInput } from '../classes/userUpdate.input';
import { Funds } from '../classes/funds';

@Resolver(User)
export default class UserResolver {
  @Authorized([UserRole.MEMBER])
  @Mutation(() => User)
  public async userUpdate(
    @Arg('input', (type) => UserUpdateInput)
    { email, phone, name }: UserUpdateInput,
    @Ctx() ctx: IContext,
  ) {
    if (ctx.user) {
      const user = await User.findByPk(ctx.user.id);

      user.email = email;
      user.phone = phone;
      user.name = name;

      return user.save();
    }

    throw new Error('Unauthorized');
  }

  @FieldResolver((type) => [Inventory])
  async currentInventory(@Root() user: User): Promise<Inventory[]> {
    return ((await user.$get<Inventory>('currentInventory', {
      where: {
        status: {
          [Op.in]: [InventoryStatus.WITHMEMBER, InventoryStatus.RETURNING],
        },
      },
    })) as Inventory[])!;
  }

  @FieldResolver((type) => [Inventory])
  async inventory(@Root() user: User): Promise<Inventory[]> {
    return ((await user.$get<Inventory>('inventory')) as Inventory[])!;
  }

  @FieldResolver((type) => Funds)
  async funds(@Root() user: User): Promise<Funds> {
    const income = ((await user.$get<Income>('incomes')) as Income[])!;
    const deposits = ((await user.$get<Deposit>('deposits')) as Deposit[])!;

    const totalIncome = income.reduce((r, i) => r + i.commission, 0);
    const totalDeposited = deposits.reduce((r, i) => r + i.amount, 0);

    return {
      available: totalIncome - totalDeposited,
      totalIncome,
      totalDeposited,
    };
  }

  @FieldResolver((type) => Boolean)
  async identificationVerified(@Root() user: User): Promise<Boolean> {
    const verifications = (await user.$get<UserVerification>(
      'verifications',
    )) as UserVerification[];

    if (verifications.length) {
      const identity = verifications.find((v) => v.type === 'IDENTITY');

      if (identity) {
        return identity.verified;
      }
    }

    return false;
  }

  @FieldResolver((type) => String)
  frontHash(@Root() user: User): string {
    if (!process.env.FRONT_CHAT_SECRET) {
      throw new Error('Missing environment variable FRONT');
    }

    return crypto
      .createHmac('sha256', process.env.FRONT_CHAT_SECRET)
      .update(user.email)
      .digest('hex');
  }
}
