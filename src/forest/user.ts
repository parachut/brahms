import Liana from 'forest-express-sequelize';
import { User } from '../models/User';
import { UserVerification } from '../models/UserVerification';
import PhoneNumber from 'awesome-phonenumber';

import { Client as Authy } from 'authy-client';
const authy = new Authy({ key: process.env.AUTHY });

Liana.collection('User', {
  fields: [
    {
      field: 'clearbitFraudScore',
      type: 'Enum',
      enums: ['low', 'medium', 'high'],
      isReadOnly: true,
      get: async (user) => {
        const verification = await UserVerification.findOne({
          where: {
            userId: user.id,
            type: 'CLEARBIT_FRAUD',
          },
          order: [['createdAt', 'DESC']],
        });

        return verification.meta.risk.level;
      },
    },
    {
      field: 'forestPhone',
      type: 'String',
      get: async (user: User) => {
        const pn = new PhoneNumber(user.phone);
        return pn.getNumber('national');
      },
      set: (user: User, phone: string) => {
        const pn = new PhoneNumber(phone, 'US');
        user.phone = pn.getNumber('e164');
        return user;
      },
    },
  ],
});
