import Liana from 'forest-express-sequelize';

Liana.collection('Address', {
  fields: [
    {
      field: 'fullAddress',
      type: 'String',
      get: (address) => {
        return (
          address.street1 +
          (address.street2 ? ' ' + address.street2 : '') +
          ', ' +
          address.city +
          ' ' +
          address.state +
          ' ' +
          address.zip
        );
      },
    },
  ],
});
