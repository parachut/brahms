import express from 'express';
import Liana from 'forest-express-sequelize';
import Sequelize from 'sequelize';

import { Inventory } from '../models/Inventory';

const router = express.Router();

router.post(
  '/stats/inventory-status-points',
  Liana.ensureAuthenticated,
  async (req, res) => {
    const inventory: any = await Inventory.findAll({
      group: ['status'],
      attributes: [
        'status',
        [Sequelize.fn('SUM', Sequelize.col('product.points')), 'total'],
      ],
      raw: true,
      include: [
        {
          association: 'product',
          attributes: [],
        },
      ],
    });

    res.send(
      inventory.map((i) => ({
        key: i.status,
        value: Number(i.total),
      })),
    );
  },
);

module.exports = router;
