import Liana from 'forest-express-sequelize';

Liana.collection('Cart', {
  actions: [
    {
      name: 'Confirm cart',
    },
    {
      name: 'Cancel cart',
    },
    {
      name: 'Export history',
      type: 'global',
      download: true,
    },
  ],
});
