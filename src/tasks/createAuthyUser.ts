import { Client as Authy } from 'authy-client';

import { User } from '../models/User';
import { UserIntegration } from '../models/UserIntegration';

const authy = new Authy({ key: process.env.AUTHY });

export async function createAuthyUser(req, res) {
  const { userId } = req.body;

  if (userId && req.header('X-AppEngine-TaskName')) {
    const user = await User.findByPk(userId, { include: ['integrations'] });

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

    return res.send(`User authy account created: ${userId} ${authyId}`).end();
  }

  return res
    .status(500)
    .send('Not authorized')
    .end();
}
