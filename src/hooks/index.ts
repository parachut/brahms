import express from 'express';
import basicAuth from 'express-basic-auth';

import { easyPost } from './easyPost';

const router = express.Router();

router.post(
  '/easypost',
  basicAuth({
    users: {
      RW3VLJQf6M6iCzDCRHP32dwLnFqAGQu8: 'cVm86FmuBoBheq74frqBM3hkZxRJVZo4',
    },
  }),
  easyPost,
);

export default router;
