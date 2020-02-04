import { Client as Authy } from 'authy-client';

import { User } from '../models/User';
import { UserIntegration } from '../models/UserIntegration';

const authy = new Authy({ key: process.env.AUTHY });

export async function createAuthyUser(
  user: User,
): Promise<Partial<UserIntegration>> {
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
