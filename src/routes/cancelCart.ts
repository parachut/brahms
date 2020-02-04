import express from 'express';
import Liana from 'forest-express-sequelize';
import fetch from 'node-fetch';
import { Op } from 'sequelize';

import { Cart } from '../models/Cart';
import { Inventory } from '../models/Inventory';
import { InventoryStatus } from '../enums/inventoryStatus';

const router = express.Router();

router.post(
  '/actions/cancel-cart',
  Liana.ensureAuthenticated,
  async (req, res) => {
    let { ids } = req.body.data.attributes;

    const carts = await Cart.findAll({
      where: { id: { [Op.in]: ids } },
      include: ['inventory'],
    });

    for (const cart of carts) {
      await Inventory.update(
        {
          memberId: null,
          status: InventoryStatus.INWAREHOUSE,
        },
        {
          where: {
            id: {
              [Op.in]: cart.inventory
                .filter((i) => i.status === InventoryStatus.SHIPMENTPREP)
                .map((i) => i.id),
            },
          },
          individualHooks: true,
        },
      );

      cart.canceledAt = new Date();
      await cart.save();
    }

    res.send({ success: 'Cart(s) are canceled!' });
  },
);

module.exports = router;
