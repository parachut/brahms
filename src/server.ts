require('dotenv').config();

import Analytics from 'analytics-node';
import { ApolloServer } from 'apollo-server-express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { createContext, EXPECTED_OPTIONS_KEY } from 'dataloader-sequelize';
import express from 'express';
import expressJwt from 'express-jwt';
import fs from 'fs';
import path from 'path';
import Redis from 'ioredis';
import { Sequelize } from 'sequelize-typescript';
import { buildSchema } from 'type-graphql';

import { customAuthChecker } from './utils/customAuthChecker';
import { migrator } from './migrator';

const PORT = process.env.PORT || 4000;
const GQLPATH = '/graphql';

const analytics = new Analytics(process.env.SEGMENT);
var redis = new Redis(parseInt(process.env.REDIS_PORT), process.env.REDIS_HOST);

const main = async () => {
  const sequelize = new Sequelize(
    'development',
    'development',
    'pDzgvREbpiFVBjEEzNxw2Z48chmrHDN',
    {
      dialect: 'postgres',
      host: '35.202.140.177',
      modelPaths: [`${__dirname}/models`],
      logging: false,
    },
  );

  const dataloaderContext = createContext(sequelize);

  // Uncomment force: true to reset DB
  sequelize.sync({
    // force: true,
  });

  const schema = await buildSchema({
    authChecker: customAuthChecker,
    resolvers: [__dirname + '/resolvers/*.resolver.ts'],
  });

  const app = express();

  app.use('/migrator', migrator);

  const server = new ApolloServer({
    introspection: true,
    playground: true,
    schema,
    context: ({ req }: any) => {
      const context = {
        analytics,
        dataloaderContext,
        redis,
        req,
        user: req.user,
      };
      return context;
    },
  });

  app.use(
    GQLPATH,
    expressJwt({
      credentialsRequired: false,
      algorithms: ['RS256'],
      secret: fs.readFileSync('./certs/public.key'),
    }),
  );

  app.use(GQLPATH, cors());
  server.applyMiddleware({ app, path: GQLPATH });

  app.use(
    require('forest-express-sequelize').init({
      authSecret: process.env.FOREST_AUTH_SECRET,
      envSecret: process.env.FOREST_ENV_SECRET,
      integrations: {
        stripe: {
          apiKey: process.env.STRIPE,
          mapping: 'User.stripeId',
          stripe: require('stripe'),
        },
      },
      sequelize,
      modelsDir: __dirname + '/models',
      configDir: __dirname + '/config',
    }),
  );

  // tslint:disable-next-line: no-console
  app.listen(PORT, () => console.log(`Listening on ${PORT}`));
};

main();
