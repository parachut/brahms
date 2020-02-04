import Analytics from 'analytics-node';
import { ApolloServer } from 'apollo-server-express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { createContext } from 'dataloader-sequelize';
import express from 'express';
import expressJwt from 'express-jwt';
import fs from 'fs';
import { buildSchema } from 'type-graphql';

require('dotenv').config();

import { sequelize } from './db';
import { customAuthChecker } from './utils/customAuthChecker';

const PORT = process.env.PORT || 4000;
const GQLPATH = '/graphql';

const analytics = new Analytics(process.env.SEGMENT);

const main = async () => {
  const dataloaderContext = createContext(sequelize);

  const schema = await buildSchema({
    authChecker: customAuthChecker,
    resolvers: [
      __dirname + '/resolvers/*.resolver.ts',
      __dirname + '/resolvers/*.resolver.js',
    ],
  });

  const app = express();

  app.use(GQLPATH, cors());

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
        dataloaderContext,
        req,
        sequelize,
        user: req.user,
      };
      return context;
    },
  });

  app.use(
    GQLPATH,
    bodyParser.json(),
    bodyParser.text({ type: 'application/graphql' }),
    expressJwt({
      algorithms: ['RS256'],
      credentialsRequired: false,
      secret: fs.readFileSync(__dirname + '/certs/public.key', 'utf8'),
    }),
  );

  server.applyMiddleware({ app, path: GQLPATH });

  app.listen(PORT, () => {
    // Instantiates a client.
    console.log(`Listening on ${PORT}`);
  });
};

main();
