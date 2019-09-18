import Liana from 'forest-express-sequelize';

Liana.collection('Bin', {
  actions: [
    {
      name: 'Generate labels',
      type: 'global',
      download: true,
    },
  ],
});
