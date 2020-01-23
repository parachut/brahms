import { Sequelize } from 'sequelize-typescript';
import throng from 'throng';

require('dotenv').config();

import { createQueue } from './redis';
import checkClearbit from './tasks/checkClearbit';
import checkClearbitFraud from './tasks/checkClearbitFraud';
import createAuthyUser from './tasks/createAuthyUser';
import createFrontContact from './tasks/createFrontContact';
import createRecurlyUser from './tasks/createRecurlyUser';
import createActiveCampaignContent from './tasks/createActiveCampaignContact';
import sendDeliveryEmail from './tasks/sendDeliveryEmail';
import sendOutboundAccessConfirmationEmail from './tasks/sendOutboundAccessConfirmationEmail';
import sendOutboundAccessShipmentEmail from './tasks/sendOutboundAccessShipmentEmail';
import sendSimpleEmail from './tasks/sendSimpleEmail';
import updateAddressCensusData from './tasks/updateAddressCensusData';
import updateProductStats from './tasks/updateProductStats';
import updateProductStock from './tasks/updateProductStock';
import updateUserPoints from './tasks/updateUserPoints';
import updateUserGeolocation from './tasks/updateUserGeolocation';

const workers = process.env.WEB_CONCURRENCY || 2;
const maxJobsPerWorker = 25;

function start() {
  const sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    modelPaths: [`${__dirname}/models`],
    dialectOptions: {
      ssl: true,
    },
  });

  try {
    const communicationQueue = createQueue('communication-queue');
    const internalQueue = createQueue('internal-queue');
    const integrationQueue = createQueue('integration-queue');
    const fraudQueue = createQueue('fraud-queue');

    communicationQueue.clean(1000000, 'failed');
    internalQueue.clean(1000000, 'failed');
    integrationQueue.clean(1000000, 'failed');
    fraudQueue.clean(1000000, 'failed');

    communicationQueue.clean(1000000);
    internalQueue.clean(1000000);
    integrationQueue.clean(1000000);
    fraudQueue.clean(1000000);

    fraudQueue.process(
      'check-clearbit-fraud',
      maxJobsPerWorker,
      checkClearbitFraud,
    );

    integrationQueue.process(
      'create-authy-user',
      maxJobsPerWorker,
      createAuthyUser,
    );
    integrationQueue.process(
      'create-front-contact',
      maxJobsPerWorker,
      createFrontContact,
    );
    integrationQueue.process(
      'create-recurly-user',
      maxJobsPerWorker,
      createRecurlyUser,
    );
    integrationQueue.process(
      'create-active-campaign-contact',
      maxJobsPerWorker,
      createActiveCampaignContent,
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
    internalQueue.process(
      'update-product-stats',
      maxJobsPerWorker,
      updateProductStats,
    );
    internalQueue.process(
      'update-user-points',
      maxJobsPerWorker,
      updateUserPoints,
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
      'send-outbound-access-shipment-email',
      maxJobsPerWorker,
      sendOutboundAccessShipmentEmail,
    );
    communicationQueue.process(
      'send-outbound-access-confirmation-email',
      maxJobsPerWorker,
      sendOutboundAccessConfirmationEmail,
    );
  } catch (e) {
    console.log(e);
  }

  console.log('listening...');
}

throng({ workers, start });
