const fs = require('fs');

module.exports = {
  development: {
    username: 'development',
    password: 'pDzgvREbpiFVBjEEzNxw2Z48chmrHDN',
    database: 'development',
    host: '35.202.140.177',
    dialect: 'postgres',
  },
  production: {
    username: 'u94i50pgq3g04f',
    password:
      'p0b3d8e7353c495b2eb9f8e06ec23d5ea5fca44b51db7d126d9414f9ec804d04b',
    port: 5432,
    database: 'da4vhsd5as770l',
    host: 'ec2-3-226-225-84.compute-1.amazonaws.com',
    dialect: 'postgres',
    dialectOptions: {
      ssl: true,
    },
  },
};
