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
      name: 'Create Shipment',
      type: 'single',
      fields: [
        {
          field: 'Inventory',
          description: 'Select the inventory for the shipment.',
          type: '[Enum]',
          isRequired: true,
        },
      ],
    },
  ],
});
