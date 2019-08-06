import Analytics from 'analytics-node';
import { ApolloServer } from 'apollo-server-express';
import cors from 'cors';
import crypto from 'crypto';
import { createContext } from 'dataloader-sequelize';
import express from 'express';
import expressJwt from 'express-jwt';
import fs from 'fs';
import Redis from 'ioredis';
import { Sequelize } from 'sequelize-typescript';
import { buildSchema } from 'type-graphql';
import jwt from 'jsonwebtoken';

require('dotenv').config();

// import { migrator } from './migrator';
import { customAuthChecker } from './utils/customAuthChecker';
import { signOptions } from '../certs';

const PORT = process.env.PORT || 4000;
const GQLPATH = '/graphql';

const analytics = new Analytics(process.env.SEGMENT);
var redis = new Redis(parseInt(process.env.REDIS_PORT), process.env.REDIS_HOST);
const jwtSecret = fs.readFileSync('./certs/private.key', 'utf8');

const main = async () => {
  const sequelize = new Sequelize(
    process.env.SQL_USER,
    process.env.SQL_DATABASE,
    process.env.SQL_PASSWORD,
    {
      dialect: 'postgres',
      host:
        process.env.NODE_ENV === 'production'
          ? `/cloudsql/${process.env.INSTANCE_CONNECTION_NAME}`
          : '127.0.0.1',
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
    resolvers: [
      __dirname + '/resolvers/*.resolver.ts',
      __dirname + '/resolvers/*.resolver.js',
    ],
  });

  const app = express();

  // app.use('/migrator', migrator);

  app.use(GQLPATH, cors());

  const server = new ApolloServer({
    introspection: true,
    playground: true,
    schema,
    context: ({ req }: any) => {
      const context = {
        analytics,
        dataloaderContext,
        sequelize,
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
      secret: fs.readFileSync('./certs/public.key', 'utf8'),
    }),
  );

  console.log(
    jwt.sign(
      {
        id: '6d6d125f-d2b9-4293-90fc-7b6ba517366e',
        roles: ['MEMBER'],
      },
      jwtSecret,
      signOptions,
    ),
  );

  app.use(GQLPATH, (err, req, res, next) => {
    if (err.name === 'UnauthorizedError' && req.method === 'POST') {
      console.log(err);
      if (req.header('refresh-token')) {
        jwt.verify(
          req.headers.authorization,
          jwtSecret,
          {
            ignoreExpiration: true,
          },
          async function(err, decoded: any) {
            if (err || typeof decoded === 'string' || !decoded) {
              return res.status(401).send('invalid_refresh_token');
            }

            const id = await redis.get(`re:${req.header('refresh-token')}`);
            if (id === decoded.payload.id) {
              const token = jwt.sign(decoded.payload, jwtSecret, signOptions);
              const refreshToken = crypto.randomBytes(128).toString('hex');

              await redis.set(
                `refreshToken:${refreshToken}`,
                decoded.payload.id,
              );

              res.setHeader('authorization', token);
              res.setHeader('refresh-token', refreshToken);

              return next(req, res);
            } else {
              return res.status(401).send('invalid_refresh_token');
            }
          },
        );
      }
    }
  });

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
      configDir: __dirname + '/forest',
    }),
  );

  // tslint:disable-next-line: no-console
  app.listen(PORT, () => console.log(`Listening on ${PORT}`));
};

main();
