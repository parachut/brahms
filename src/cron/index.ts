import express from 'express';

import { hourlyBiller } from './hourlyBiller';

const router = express.Router();

router.get('/hourly-biller', hourlyBiller);

export default router;
