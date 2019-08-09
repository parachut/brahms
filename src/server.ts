import cloudTasks from '@google-cloud/tasks';
import Analytics from 'analytics-node';
import { ApolloServer } from 'apollo-server-express';
import bodyParser from 'body-parser';
import cors from 'cors';
import crypto from 'crypto';
import { createContext } from 'dataloader-sequelize';
import express from 'express';
import expressJwt from 'express-jwt';
import fs from 'fs';
import { createServer } from 'http';
import jwt from 'jsonwebtoken';
import { Sequelize } from 'sequelize-typescript';
import { buildSchema } from 'type-graphql';

require('dotenv').config();

import { signOptions } from '../certs';
import { pubSub, redis } from './redis';
import tasks from './tasks';
import { customAuthChecker } from './utils/customAuthChecker';

// import { migrator } from './migrator';
const PORT = process.env.PORT || 4000;
const GQLPATH = '/graphql';

const analytics = new Analytics(process.env.SEGMENT);

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
      logging: false,
      modelPaths: [`${__dirname}/models`],
    },
  );

  const dataloaderContext = createContext(sequelize);

  // Uncomment force: true to reset DB
  if (process.env.NODE_ENV !== 'production') {
    sequelize.sync({
      // force: true,
    });
  }

  const schema = await buildSchema({
    authChecker: customAuthChecker,
    resolvers: [
      __dirname + '/resolvers/*.resolver.ts',
      __dirname + '/resolvers/*.resolver.js',
    ],
    pubSub,
  });

  const app = express();

  // app.use('/migrator', migrator);

  if (process.env.NODE_ENV !== 'production') {
    app.use(GQLPATH, cors());
  } else {
    app.set('trust proxy', true);
  }

  const server = new ApolloServer({
    introspection: true,
    playground: true,
    schema,
    context: ({ req, connection }: any) => {
      if (!req || !req.headers) {
        return connection.context;
      }
      const context = {
        analytics,
        clientIp: req.header('x-appengine-user-ip'),
        dataloaderContext,
        redis,
        req,
        sequelize,
        user: req.user,
      };
      return context;
    },
    subscriptions: {
      onConnect: (connectionParams: any, webSocket) => {
        if (connectionParams.authToken) {
          const decoded: any = jwt.verify(
            connectionParams.authToken,
            fs.readFileSync('./certs/public.key', 'utf8'),
            { algorithms: ['RS256'] },
          );

          return {
            currentUser: decoded.id,
          };
        }

        throw new Error('Missing auth token!');
      },
    },
  });

  app.use(
    GQLPATH,
    expressJwt({
      algorithms: ['RS256'],
      credentialsRequired: false,
      secret: fs.readFileSync('./certs/public.key', 'utf8'),
    }),
  );

  app.use(GQLPATH, (err, req, res, next) => {
    if (err.name === 'UnauthorizedError' && req.method === 'POST') {
      console.log(err);
      if (req.header('refresh-token')) {
        jwt.verify(
          req.headers.authorization,
          fs.readFileSync('./certs/public.key', 'utf8'),
          { ignoreExpiration: true, algorithms: ['RS256'] },
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
      configDir: __dirname + '/forest',
      envSecret: process.env.FOREST_ENV_SECRET,
      integrations: {
        stripe: {
          apiKey: process.env.STRIPE,
          mapping: 'User.stripeId',
          stripe: require('stripe'),
        },
      },
      modelsDir: __dirname + '/models',
      sequelize,
    }),
  );

  app.use('/tasks', bodyParser.raw({ type: 'application/octet-stream' }));
  app.use('/tasks', tasks);

  const wss = createServer(app);
  server.installSubscriptionHandlers(wss);

  // tslint:disable-next-line: no-console
  wss.listen(PORT, async () => {
    // Instantiates a client.
    const client = new cloudTasks.CloudTasksClient();
    const parent = client.locationPath('parachut-216816', 'us-central1');

    const [queues] = await client.listQueues({ parent });

    if (
      !queues.find(
        (queue) =>
          queue.name ===
          'projects/parachut-216816/locations/us-central1/queues/parachut-appengine-queue',
      )
    ) {
      await client.createQueue({
        // The fully qualified path to the location where the queue is created
        parent,
        queue: {
          // The fully qualified path to the queue
          name: client.queuePath(
            'parachut-216816',
            'us-central1',
            'parachut-appengine-queue',
          ),
          appEngineHttpQueue: {
            appEngineRoutingOverride: {
              service: 'default',
            },
          },
        },
      });
    }

    console.log(`Listening on ${PORT}`);
  });
};

main();
