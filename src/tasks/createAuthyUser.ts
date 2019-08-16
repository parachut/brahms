import { Client as Authy } from 'authy-client';

import { User } from '../models/User';
import { UserIntegration } from '../models/UserIntegration';

const authy = new Authy({ key: process.env.AUTHY });

async function createAuthyUser(job) {
  const { userId } = job.data;

  console.log(job.data);

  if (userId) {
    try {
      const user = await User.findByPk(userId, { include: ['integrations'] });

      console.log(user);

      const {
        user: { id: authyId },
      } = await authy.registerUser({
        countryCode: 'US',
        email: user.email,
        phone: user.phone,
      });

      await UserIntegration.create({
        type: 'AUTHY',
        value: authyId,
        userId: user.id,
      });
    } catch (e) {
      console.log(e);
    }

    return `User authy account created: ${userId} ${authyId}`;
  }
}

export default createAuthyUser;
