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
          type: ['Enum'],
          isRequired: true,
        },
        {
          field: 'Service',
          description: 'Select a UPS service for the shipment.',
          type: ['Enum'],
          enums: ['Ground', '2ndDayAir', 'NextDayAir'],
          isRequired: true,
        },
      ],
    },
  ],
});
