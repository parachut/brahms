import Queue from 'bull';
import throng from 'throng';
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
import { createQueue } from './redis';

let workers = process.env.WEB_CONCURRENCY || 2;

const maxJobsPerWorker = 25;

new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  modelPaths: [`${__dirname}/models`],
  dialectOptions: {
    ssl: true,
  },
});

function start() {
  try {
    const checkClearbitFraudQueue = createQueue('check-clearbit-fraud');
    const checkoutQueue = createQueue('checkout');
    const createAuthyUserQueue = createQueue('create-authy-user');
    const createEasyPostAddressQueue = createQueue('create-easypost-address');
    const createFrontContactQueue = createQueue('create-front-contact');
    const createStripeUserQueue = createQueue('create-stripe-user');
    const runClearbitQueue = createQueue('run-clearbit');
    const updateAddressCensusDataQueue = createQueue(
      'update-address-census-data',
    );
    const updateProductStockQueue = createQueue('update-product-stock');
    const updateUserGeolocationQueue = createQueue('update-user-geolocation');

    checkClearbitFraudQueue.process(maxJobsPerWorker, checkClearbitFraud);
    checkoutQueue.process(maxJobsPerWorker, checkout);
    createAuthyUserQueue.process(maxJobsPerWorker, createAuthyUser);
    createEasyPostAddressQueue.process(maxJobsPerWorker, createEasyPostAddress);
    createFrontContactQueue.process(maxJobsPerWorker, createFrontContact);
    createStripeUserQueue.process(maxJobsPerWorker, createStripeUser);
    runClearbitQueue.process(maxJobsPerWorker, runClearbit);
    updateAddressCensusDataQueue.process(
      maxJobsPerWorker,
      updateAddressCensusData,
    );
    updateProductStockQueue.process(maxJobsPerWorker, updateProductStock);
    updateUserGeolocationQueue.process(maxJobsPerWorker, updateUserGeolocation);

    console.log('listening');
  } catch (e) {
    console.log(e);
  }
}

throng({ workers, start });
