import express from 'express';
import Liana from 'forest-express-sequelize';
import fetch from 'node-fetch';
import { Op } from 'sequelize';

import { Cart } from '../models/Cart';

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

    res.send({ success: 'Cart(s) are confirmed!' });
  },
);

module.exports = router;
