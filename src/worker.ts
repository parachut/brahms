import Queue from 'bull';
import { Sequelize } from 'sequelize-typescript';

require('dotenv').config();

import checkClearbitFraud from './tasks/checkClearbitFraud';
import checkout from './tasks/checkout';
import createAuthyUser from './tasks/createAuthyUser';
import createEasyPostAddress from './tasks/createEasyPostAddress';
import createFrontContact from './tasks/createFrontContact';
import createStripeUser from './tasks/createStripeUser';
import runClearbit from './tasks/runClearbit';
import updateAddressCensusData from './tasks/updateAddressCensusData';
import updateProductStock from './tasks/updateProductStock';
import updateUserGeolocation from './tasks/updateUserGeolocation';

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const maxJobsPerWorker = 25;

const checkClearbitFraudQueue = new Queue('check-clearbit-fraud', REDIS_URL);
const checkoutQueue = new Queue('checkout', REDIS_URL);
const createAuthyUserQueue = new Queue('create-authy-user', REDIS_URL);
const createEasyPostAddressQueue = new Queue(
  'create-easypost-address',
  REDIS_URL,
);
const createFrontContactQueue = new Queue('create-front-contact', REDIS_URL);
const createStripeUserQueue = new Queue('create-stripe-user', REDIS_URL);
const runClearbitQueue = new Queue('run-clearbit', REDIS_URL);
const updateAddressCensusDataQueue = new Queue(
  'update-address-census-data',
  REDIS_URL,
);
const updateProductStockQueue = new Queue('update-product-stock', REDIS_URL);
const updateUserGeolocationQueue = new Queue(
  'update-user-geolocation',
  REDIS_URL,
);

const sequelize = process.env.DATABASE_URL
  ? new Sequelize(process.env.DATABASE_URL, {
      dialect: 'postgres',
      modelPaths: [`${__dirname}/models`],
    })
  : new Sequelize(
      process.env.SQL_USER,
      process.env.SQL_DATABASE,
      process.env.SQL_PASSWORD,
      {
        dialect: 'postgres',
        host:
          process.env.NODE_ENV === 'production'
            ? `/cloudsql/${process.env.INSTANCE_CONNECTION_NAME}`
            : '35.202.140.177',
        logging: false,
        modelPaths: [`${__dirname}/models`],
      },
    );

checkClearbitFraudQueue.process(maxJobsPerWorker, checkClearbitFraud);
checkoutQueue.process(maxJobsPerWorker, checkout);
createAuthyUserQueue.process(maxJobsPerWorker, createAuthyUser);
createEasyPostAddressQueue.process(maxJobsPerWorker, createEasyPostAddress);
createFrontContactQueue.process(maxJobsPerWorker, createFrontContact);
createStripeUserQueue.process(maxJobsPerWorker, createStripeUser);
runClearbitQueue.process(maxJobsPerWorker, runClearbit);
updateAddressCensusDataQueue.process(maxJobsPerWorker, updateAddressCensusData);
updateProductStockQueue.process(maxJobsPerWorker, updateProductStock);
updateUserGeolocationQueue.process(maxJobsPerWorker, updateUserGeolocation);