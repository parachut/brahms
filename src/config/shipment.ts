const Liana = require('forest-express-sequelize');

Liana.collection('Shipment', {
  actions: [
    {
      name: 'Print Label',
    },
  ],
});
