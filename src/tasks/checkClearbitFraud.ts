import { Client } from 'clearbit';

import { User } from '../models/User';
import { UserVerification } from '../models/UserVerification';

const clearbit = new Client({ key: process.env.CLEARBIT });

export async function checkClearbitFraud(req, res) {
  const { ipAddress, userId } = req.body;

  if (userId && req.header('X-AppEngine-TaskName')) {
    const user = await User.findByPk(userId, {
      include: [
        {
          association: 'addresses',
          where: {
            primary: true,
          },
        },
      ],
    });

    const result = await clearbit.Risk.calculate({
      country_code: user.addresses.length ? user.addresses[0].country : 'US',
      email: user.email,
      ip: ipAddress,
      name: user.name,
      zip_code: user.addresses.length ? user.addresses[0].zip : undefined,
    });

    console.log(result);

    await UserVerification.create({
      type: 'CLEARBIT_FRAUD',
      verified: result.risk.level !== 'high',
      meta: result,
      userId: user.id,
    });

    return res.send(`User authy account created: ${userId} ${result.id}`).end();
  }

  return res
    .status(500)
    .send('Not authorized')
    .end();
}
