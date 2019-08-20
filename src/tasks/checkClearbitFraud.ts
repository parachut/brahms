import { Client } from 'clearbit';

import { User } from '../models/User';
import { UserVerification } from '../models/UserVerification';

const clearbit = new Client({ key: process.env.CLEARBIT });

async function checkClearbitFraud(job) {
  const { ipAddress, userId } = job.data;

  if (userId && ipAddress) {
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

    return UserVerification.create({
      type: 'CLEARBIT_FRAUD',
      verified: result.risk.level !== 'high',
      meta: result,
      userId: user.id,
    });
  }
}

export default checkClearbitFraud;
