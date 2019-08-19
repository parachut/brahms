import Liana from 'forest-express-sequelize';

Liana.collection('Shipment', {
  actions: [
    {
      name: 'Print Label',
    },
  ],
});
