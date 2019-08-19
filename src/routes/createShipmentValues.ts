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

    const cart = await Cart.findOne({
      where: { id },
      include: [
        {
          association: 'inventory',
          include: ['product'],
        },
      ],
    });

    return cart.inventory.map((inventory) => ({
      value: inventory.id,
      label: `${inventory.product.name} (${inventory.serial})`,
    }));
  },
);

module.exports = router;
