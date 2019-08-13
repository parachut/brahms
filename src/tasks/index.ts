import express from 'express';

import { checkClearbitFraud } from './checkClearbitFraud';
import { createAuthyUser } from './createAuthyUser';
import { createEasyPostAddress } from './createEasyPostAddress';
import { createFrontContact } from './createFrontContact';
import { createStripeUser } from './createStripeUser';
import { runClearbit } from './runClearbit';
import { updateUserGeolocation } from './updateUserGeolocation';
import { updateAddressCensusData } from './updateAddressCensusData';

const router = express.Router();

router.post('/update-user-geolocation', updateUserGeolocation);
router.post('/create-stripe-user', createStripeUser);
router.post('/create-authy-user', createAuthyUser);
router.post('/create-front-contact', createFrontContact);
router.post('/create-easypost-address', createEasyPostAddress);
router.post('/check-clearbit-fraud', checkClearbitFraud);
router.post('/run-clearbit', runClearbit);
router.post('/update-address-censusdata', updateAddressCensusData);

export default router;
