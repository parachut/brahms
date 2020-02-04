import PhoneNumber from 'awesome-phonenumber';
import Liana from 'forest-express-sequelize';

import { User } from '../models/User';
import { UserVerification } from '../models/UserVerification';

Liana.collection('User', {
  actions: [
    {
      name: 'Export proximity',
      type: 'global',
      download: true,
    },
    {
      name: 'Login as',
      type: 'single',
    },
    {
      name: 'Create ShipKit',
      type: 'single',
      fields: [
        {
          field: 'Airbox',
          type: 'Boolean',
          isRequired: false,
        },
      ],
    },
  ],
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
        if (verification) {
          return verification.meta.risk.level;
        } else {
          return 'low';
        }
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
