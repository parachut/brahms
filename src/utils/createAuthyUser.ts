import { Client as Authy } from 'authy-client';

import { User } from '../models/User';
import { NewUserIntegration } from './newUserIntegration.interface';

const authy = new Authy({ key: process.env.AUTHY });

export async function createAuthyUser(user: User): Promise<NewUserIntegration> {
  const {
    user: { id: authyId },
  } = await authy.registerUser({
    countryCode: 'US',
    email: user.email,
    phone: user.phone,
  });

  return {
    type: 'AUTHY',
    value: authyId,
    userId: user.id,
  };
}
