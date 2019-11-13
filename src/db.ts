import { Sequelize } from 'sequelize-typescript';

export const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  modelPaths: [`${__dirname}/models`],
  logging: false,
  dialectOptions: {
    ssl: true,
  },
});
