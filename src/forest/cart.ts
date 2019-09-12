import Liana from 'forest-express-sequelize';

Liana.collection('Cart', {
  actions: [
    {
      name: 'Confirm Cart',
    },
    {
      name: 'Cancel Cart',
    },
    {
      name: 'Export History',
      type: 'global',
      download: true,
    },
  ],
});
