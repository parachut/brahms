import Liana from 'forest-express-sequelize';

Liana.collection('Inventory', {
  actions: [
    {
      name: 'Export commissions',
      type: 'global',
      download: true,
      fields: [
        {
          field: 'Start date',
          type: 'Dateonly',
          isRequired: true,
        },
        {
          field: 'End date',
          type: 'Dateonly',
          isRequired: true,
        },
      ],
    },
  ],
});
