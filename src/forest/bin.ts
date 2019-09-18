import Liana from 'forest-express-sequelize';

import { Bin } from '../models/Bin';

Liana.collection('Bin', {
  actions: [
    {
      name: 'Generate labels',
      type: 'global',
      download: true,
    },
  ],
  fields: [
    {
      field: 'fullName',
      type: 'String',
      readonly: true,
      get: async (bin: Bin) => {
        return `${bin.location}-${bin.row}-${bin.column}-${bin.cell}`;
      },
    },
  ],
});
