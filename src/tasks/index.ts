import express from 'express';

import { updateUserGeolocation } from './updateUserGeolocation';
import { createStripeUser } from './createStripeUser';
import { createAuthyUser } from './createAuthyUser';
import { createFrontContact } from './createFrontContact';
import { createEasyPostAddress } from './createEasyPostAddress';
import { checkClearbitFraud } from './checkClearbitFraud';

const router = express.Router();

router.post('/update-user-geolocation', updateUserGeolocation);
router.post('/create-stripe-user', createStripeUser);
router.post('/create-authy-user', createAuthyUser);
router.post('/create-front-contact', createFrontContact);
router.post('/create-easypost-address', createEasyPostAddress);
router.post('/check-clearbit-fraud', checkClearbitFraud);

export default router;
