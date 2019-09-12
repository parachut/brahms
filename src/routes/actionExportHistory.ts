import express from 'express';
import Liana from 'forest-express-sequelize';
import { Op } from 'sequelize';
import stringify from 'csv-stringify';

import { Cart } from '../models/Cart';

const router = express.Router();

router.post(
  '/actions/export-history',
  Liana.ensureAuthenticated,
  async (req, res) => {
    let { ids } = req.body.data.attributes;

    const carts = await Cart.findAll({
      where:
        ids && ids.length
          ? {
              '$inventory.id$': { id: { [Op.in]: ids } },
              completedAt: { [Op.not]: null },
            }
          : {
              completedAt: { [Op.not]: null },
            },
      include: [
        {
          association: 'inventory',
          attributes: ['id'],
          include: ['product'],
        },
        {
          association: 'items',
          include: ['product'],
        },
        {
          association: 'shipments',
          order: [['carrierReceivedAt', 'DESC']],
        },
        {
          association: 'user',
        },
      ],
    });

    const report = carts.map((cart) => {
      let value = cart.items.reduce(
        (r: number, i: any) => r + i.quantity * i.product.points,
        0,
      );

      if (value <= 0) {
        value = cart.inventory.reduce(
          (r: number, i: any) => r + i.product.points,
          0,
        );
      }

      return {
        completedAt: new Date(cart.completedAt).toLocaleString(),
        shippedAt: cart.shipments.length
          ? new Date(cart.shipments[0].carrierReceivedAt).toLocaleString()
          : 'no shipment information',
        value,
        items: cart.inventory
          ? cart.inventory.length
          : cart.items.reduce((r: number, i: any) => r + i.quantity, 0),
        createdAt: new Date(cart.createdAt).toLocaleString(),
        member: cart.user.name,
      };
    });

    const columns = {
      completedAt: 'Completed',
      shippedAt: 'Shipped',
      value: 'Value',
      items: 'Items',
      member: 'Member',
      createdAt: 'Cart Created',
    };

    stringify(
      report,
      {
        header: true,
        columns,
      },
      function(err, data) {
        if (err) {
          return res.status(500).send(err);
        }

        res.setHeader(
          'Content-disposition',
          `attachment; filename=order-history.csv`,
        );
        res.set('Content-Type', 'text/csv');
        res.status(200).send(data);
      },
    );
  },
);

module.exports = router;
