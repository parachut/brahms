import express from 'express';
import Liana from 'forest-express-sequelize';

import { Cart } from '../models/Cart';

const router = express.Router();

router.post(
  '/actions/create-shipment/values',
  Liana.ensureAuthenticated,
  async (req, res) => {
    const { id } = req.body.data.attributes.values;
    console.log(req.body.data.attributes);

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

      console.log(cart);

      res.send({
        data: cart.inventory.map((inventory) => ({
          value: inventory.id,
          label: `${inventory.product.name} (${inventory.serial})`,
        })),
      });
    } catch (e) {
      res.status(500).send(e);
    }
  },
);

module.exports = router;
