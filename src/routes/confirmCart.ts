import express from 'express';
import Liana from 'forest-express-sequelize';
import { Op } from 'sequelize';

import { Cart } from '../models/Cart';
import { Inventory } from '../models/Inventory';
import { Shipment } from '../models/Shipment';
import { ShipmentDirection } from '../enums/shipmentDirection';
import { ShipmentType } from '../enums/shipmentType';
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

      const cart = await Cart.findByPk(id, {
        include: ['inventory'],
      });
      const shipment = await Shipment.create({
        direction: ShipmentDirection.OUTBOUND,
        expedited: cart.service !== 'Ground',
        type: ShipmentType.ACCESS,
        cartId: id,
      });

      await shipment.$set('inventory', cart.inventory.map((item) => item.id));
    }

    await res.send({ success: 'Cart(s) are confirmed!' });
  },
);

module.exports = router;
