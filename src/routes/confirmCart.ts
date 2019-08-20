import express from 'express';
import Liana from 'forest-express-sequelize';
import { Op } from 'sequelize';

import { Cart } from '../models/Cart';
import { createQueue } from '../redis';

const communicationQueue = createQueue('communication-queue');

const router = express.Router();

router.post(
  '/actions/confirm-cart',
  Liana.ensureAuthenticated,
  async (req, res) => {
    let { ids } = req.body.data.attributes;

    await Cart.update(
      {
        confirmedAt: new Date(),
      },
      {
        where: { id: { [Op.in]: ids } },
      },
    );

    for (const id of ids) {
      communicationQueue.add('send-outbound-access-confirmation-email', {
        cartId: id,
      });
    }

    await res.send({ success: 'Cart(s) are confirmed!' });
  },
);

module.exports = router;
