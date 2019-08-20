import { Client as Authy } from 'authy-client';

import { User } from '../models/User';
import { UserIntegration } from '../models/UserIntegration';

const authy = new Authy({ key: process.env.AUTHY });

async function createAuthyUser(job) {
  const { userId } = job.data;

  if (userId) {
    const user = await User.findByPk(userId, { include: ['integrations'] });

    const {
      user: { id: authyId },
    } = await authy.registerUser({
      countryCode: 'US',
      email: user.email,
      phone: user.phone,
    });

    return UserIntegration.create({
      type: 'AUTHY',
      value: authyId,
      userId: user.id,
    });
  }
}

export default createAuthyUser;
