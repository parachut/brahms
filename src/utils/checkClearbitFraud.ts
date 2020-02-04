import { Client } from 'clearbit';

import { Address } from '../models/Address';
import { User } from '../models/User';
import { UserVerification } from '../models/UserVerification';

const clearbit = new Client({ key: process.env.CLEARBIT });

export async function checkClearbitFraud(
  userId: string,
  zip: string,
  country: string = 'US',
  ipAddress: string = '0.0.0.0',
): Promise<Partial<UserVerification>> {
  const user = await User.findByPk(userId);

  const result = await clearbit.Risk.calculate({
    country_code: country,
    email: user.email,
    ip: ipAddress,
    name: user.name,
    zip_code: zip,
  });

  return {
    type: 'CLEARBIT_FRAUD',
    verified: result.risk.level !== 'high',
    meta: JSON.stringify(result),
    userId: userId,
  };
}
