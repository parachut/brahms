import { Sequelize } from 'sequelize-typescript'
import parseDbUrl from 'parse-database-url'

const dbConfig = parseDbUrl(process.env['DATABASE_URL'])
const dbRead = parseDbUrl(process.env['HEROKU_POSTGRESQL_COPPER'])

export const sequelize = new Sequelize(
  dbConfig.database,
  dbConfig.user,
  dbConfig.password,
  {
    dialect: 'postgres',
    modelPaths: [`${__dirname}/models`],
    logging: false,
    dialectOptions: {
      ssl: true,
    },
    replication: {
      read: [
        {
          host: dbRead.host,
          port: dbRead.port,
        },
      ],
      write: {
        host: dbConfig.host,
        port: dbConfig.port,
      },
    },
    pool: {
      max: 20,
      idle: 30000,
    },
  },
)
