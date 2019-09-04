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
  staging: {
    username: 'u5t7dp4se9qdo2',
    password:
      'p759f021afa4382d193b3f9096022f55fe831ef539841e0cf38275a8c6c02434c',
    port: 5432,
    database: 'd92p2ghoig3ies',
    host: 'ec2-18-210-209-254.compute-1.amazonaws.com',
    dialect: 'postgres',
    dialectOptions: {
      ssl: true,
    },
  },
};
