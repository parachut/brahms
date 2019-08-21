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

      const [inventory, shipment] = await Promise.all([
        Inventory.findAll({
          where: {
            cartId: id,
          },
        }),
        Shipment.create({
          direction: ShipmentDirection.OUTBOUND,
          type: ShipmentType.ACCESS,
          service: '2ndDayAirAM',
          cartId: id,
        }),
      ]);

      await shipment.$set('inventory', inventory);
    }

    await res.send({ success: 'Cart(s) are confirmed!' });
  },
);

module.exports = router;
