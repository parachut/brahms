import express from 'express';
import basicAuth from 'express-basic-auth';
import bodyParser from 'body-parser';

import { easypost } from './easypost';

const router = express.Router();

router.post(
  '/easypost',
  bodyParser.json(),
  basicAuth({
    users: {
      RW3VLJQf6M6iCzDCRHP32dwLnFqAGQu8: 'cVm86FmuBoBheq74frqBM3hkZxRJVZo4',
    },
  }),
  easypost,
);

export default router;
