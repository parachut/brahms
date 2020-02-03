import express from 'express';
import fs from 'fs';

require('dotenv').config();

import { sequelize } from './db';

const PORT = process.env.PORT || 4000;

const main = async () => {
  const app = express();

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
