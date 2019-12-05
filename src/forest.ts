import Analytics from 'analytics-node';
import { ApolloServer } from 'apollo-server-express';
import cors from 'cors';
import crypto from 'crypto';
import { createContext } from 'dataloader-sequelize';
import express from 'express';
import expressJwt from 'express-jwt';
import fs from 'fs';
import { createServer } from 'http';
import jwt from 'jsonwebtoken';
import requestIp from 'request-ip';
import { buildSchema } from 'type-graphql';
// import jsonwebtoken from 'jsonwebtoken';

require('dotenv').config();

import { signOptions } from '../certs';
import { sequelize } from './db';
import hooks from './hooks';
import { redis } from './redis';
import { customAuthChecker } from './utils/customAuthChecker';

// import { migrator } from './migrator';
const PORT = process.env.PORT || 4000;
const GQLPATH = '/graphql';

const analytics = new Analytics(process.env.SEGMENT);
const jwtSecret = fs.readFileSync('./certs/private.key', 'utf8');

const main = async () => {
  const app = express();
  // app.use('/migrator', migrator);

  app.use(
    require('forest-express-sequelize').init({
      authSecret: process.env.FOREST_AUTH_SECRET,
      configDir: __dirname + '/forest',
      envSecret: process.env.FOREST_ENV_SECRET,
      modelsDir: __dirname + '/models',
      sequelize,
    }),
  );

  fs.readdirSync(__dirname + '/routes').forEach((file) => {
    if (file[0] !== '.') {
      app.use('/forest', require('./routes/' + file));
    }
  });

  app.listen(PORT, () => {
    // Instantiates a client.
    console.log(`Listening on ${PORT}`);
  });
};

main();
