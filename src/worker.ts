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
import checkClearbit from './tasks/checkClearbit';
import updateAddressCensusData from './tasks/updateAddressCensusData';
import updateProductStock from './tasks/updateProductStock';
import updateUserGeolocation from './tasks/updateUserGeolocation';
import sendSimpleEmail from './tasks/sendSimpleEmail';
import sendDeliveryEmail from './tasks/sendDeliveryEmail';
import sendOutboundEarnShipmentEmail from './tasks/sendOutboundEarnShipmentEmail';
import sendOutboundEarnConfirmationEmail from './tasks/sendOutboundEarnConfirmationEmail';

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
    const communicationQueue = createQueue('communication-queue');
    const internalQueue = createQueue('internal-queue');
    const integrationQueue = createQueue('integration-queue');
    const fraudQueue = createQueue('fraud-queue');

    fraudQueue.process(
      'check-clearbit-fraud',
      maxJobsPerWorker,
      checkClearbitFraud,
    );
    internalQueue.process('checkout', maxJobsPerWorker, checkout);
    integrationQueue.process(
      'create-authy-user',
      maxJobsPerWorker,
      createAuthyUser,
    );
    integrationQueue.process(
      'create-easypost-address',
      maxJobsPerWorker,
      createEasyPostAddress,
    );
    integrationQueue.process(
      'create-front-contact',
      maxJobsPerWorker,
      createFrontContact,
    );
    integrationQueue.process(
      'create-stripe-user',
      maxJobsPerWorker,
      createStripeUser,
    );
    integrationQueue.process('check-clearbit', maxJobsPerWorker, checkClearbit);
    integrationQueue.process(
      'update-address-census-data',
      maxJobsPerWorker,
      updateAddressCensusData,
    );
    internalQueue.process(
      'update-product-stock',
      maxJobsPerWorker,
      updateProductStock,
    );
    integrationQueue.process(
      'update-user-geolocation',
      maxJobsPerWorker,
      updateUserGeolocation,
    );
    communicationQueue.process(
      'send-simple-email',
      maxJobsPerWorker,
      sendSimpleEmail,
    );
    communicationQueue.process(
      'send-delivery-email',
      maxJobsPerWorker,
      sendDeliveryEmail,
    );
    communicationQueue.process(
      'send-outbound-earn-shipment-email',
      maxJobsPerWorker,
      sendOutboundEarnShipmentEmail,
    );
    communicationQueue.process(
      'send-outbound-earn-confirmation-email',
      maxJobsPerWorker,
      sendOutboundEarnConfirmationEmail,
    );

    console.log('listening');
  } catch (e) {
    console.log(e);
  }
}

throng({ workers, start });
