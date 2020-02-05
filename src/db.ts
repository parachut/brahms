import { Sequelize } from 'sequelize-typescript';
import { readFileSync } from 'fs';

export const sequelize = new Sequelize(
  'da4vhsd5as770l',
  '37CDm24TUX7sKMJWCCBUtxYRr',
  'CJC6QupaPb3rcR4r8dJpj8W77',
  {
    dialect: 'postgres',
    modelPaths: [`${__dirname}/models`],
    logging: false,
    host: process.env.POSTGRES_HOST,
    dialectOptions: {
      ssl:
        process.env.NODE_ENV !== 'production'
          ? {
              ca: readFileSync(__dirname + '/sql/server-ca.pem'),
              cert: readFileSync(__dirname + '/sql/client.pem'),
              key: readFileSync(__dirname + '/sql/client.key'),
              rejectUnauthorized: false,
            }
          : undefined,
    },
    pool: {
      max: 20,
      idle: 30000,
    },
  },
);
