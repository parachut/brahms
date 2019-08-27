import crypto from 'crypto';
import { Op } from 'sequelize';
import { FieldResolver, Resolver, Root } from 'type-graphql';

import { InventoryStatus } from '../enums/inventoryStatus';
import { Inventory } from '../models/Inventory';
import { User } from '../models/User';
import { UserVerification } from '../models/UserVerification';

@Resolver(User)
export default class UserResolver {
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
