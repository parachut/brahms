import express from 'express';
import Liana from 'forest-express-sequelize';
import { Op } from 'sequelize';

import { Cart } from '../models/Cart';
import { Inventory } from '../models/Inventory';
import { Shipment } from '../models/Shipment';
import { ShipmentDirection } from '../enums/shipmentDirection';
import { ShipmentType } from '../enums/shipmentType';
import { sendEmail } from '../utils/sendEmail';
import { plans } from '../decorators/plans';

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
      const cart = await Cart.findByPk(id, {
        include: [
          {
            association: 'user',
            include: [
              {
                association: 'currentInventory',
                include: ['product'],
              },
              'integrations',
            ],
          },
          {
            association: 'items',
            include: ['product'],
          },
        ],
      });

      const total = cart.user.currentInventory.reduce(
        (r, i) => r + i.product.points,
        0,
      );

      const shipment = await Shipment.create({
        direction: ShipmentDirection.OUTBOUND,
        expedited: cart.service !== 'Ground',
        type: ShipmentType.ACCESS,
        cartId: id,
      });

      await sendEmail({
        to: cart.user.email,
        from: 'support@parachut.co',
        id: 12931487,
        data: {
          purchase_date: new Date().toDateString(),
          name: cart.user.name,
          chutItems: cart.items.map((item) => ({
            image: item.product.images.length
              ? `https://parachut.imgix.net/${item.product.images[0]}`
              : '',
            name: item.product.name,
            points: item.product.points,
          })),
          planId: cart.planId,
          monthly: plans[cart.planId],
          pointsOver: Math.max(0, total - Number(cart.planId)),
          overage: Math.max(0, total - Number(cart.planId)) * 0.1,
          protectionPlan: cart.protectionPlan,
          totalMonthly: total + Math.max(0, total - Number(cart.planId)) * 0.1,
          availablePoints: cart.user.points - total,
          cartPoints: cart.items.reduce((r, i) => r + i.points, 0),
        },
      });

      await shipment.$set(
        'inventory',
        cart.inventory.map((item) => item.id),
      );
    }

    await res.send({ success: 'Cart(s) are confirmed!' });
  },
);

module.exports = router;
