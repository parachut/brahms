import express from 'express';
import Liana from 'forest-express-sequelize';

import { Cart } from '../models/Cart';

const router = express.Router();

router.post(
  '/actions/create-shipment/values',
  Liana.ensureAuthenticated,
  async (req, res) => {
    const { id } = req.body.data.attributes.values;

    try {
      const cart = await Cart.findOne({
        where: { id },
        include: [
          {
            association: 'inventory',
            include: ['product'],
          },
        ],
      });

      res.send({
        data: cart.inventory.map((inventory) => inventory.serial),
      });
    } catch (e) {
      res.status(500).send(e);
    }
  },
);

module.exports = router;
