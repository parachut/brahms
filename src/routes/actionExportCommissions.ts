import express from 'express';
import Liana from 'forest-express-sequelize';
import { Op } from 'sequelize';
import stringify from 'csv-stringify';
import numeral from 'numeral';

import { calcDailyCommission } from '../utils/calc';
import { Inventory } from '../models/Inventory';
import { ShipmentDirection } from '../enums/shipmentDirection';

const router = express.Router();

router.post(
  '/actions/export-commissions',
  Liana.ensureAuthenticated,
  async (req, res) => {
    const { ids } = req.body.data.attributes;
    const attrs = req.body.data.attributes.values;

    const startDate = new Date(attrs['Start date']);
    const endDate = new Date(attrs['End date']);

    const items = await Inventory.findAll({
      where: ids && ids.length ? { id: { [Op.in]: ids } } : {},
      include: [
        'user',
        'product',
        {
          association: 'shipments',
          where: {
            [Op.or]: [
              {
                carrierDeliveredAt: {
                  [Op.gte]: startDate,
                  [Op.lte]: endDate,
                },
                direction: ShipmentDirection.OUTBOUND,
              },
              {
                carrierReceivedAt: {
                  [Op.gte]: startDate,
                  [Op.lte]: endDate,
                },
                direction: ShipmentDirection.INBOUND,
              },
            ],
          },
          order: [['carrierReceivedAt', 'ASC']],
        },
      ],
    });

    const report = items.map((item) => {
      let lastOutbound: number = 0;
      let secondsInCirculation = item.shipments.reduce((r: number, i: any) => {
        if (lastOutbound > 0 && i.direction === 'INBOUND') {
          return r + (new Date(i.carrierReceivedAt).getTime() - lastOutbound);
        } else if (i.direction === 'OUTBOUND') {
          lastOutbound = new Date(i.carrierDeliveredAt).getTime();
          return r;
        } else if (r === 0 && lastOutbound === 0 && i.direction === 'INBOUND') {
          return (
            r + (new Date(i.carrierReceivedAt).getTime() - startDate.getTime())
          );
        }
      }, 0);

      if (secondsInCirculation > 0) {
        const lastShipment = item.shipments[item.shipments.length - 1];
        if (lastShipment.direction === 'OUTBOUND') {
          secondsInCirculation =
            secondsInCirculation +
            (endDate.getTime() -
              new Date(lastShipment.carrierDeliveredAt).getTime());
        }
      }

      if (
        (item.status === 'WITHMEMBER' || item.status === 'RETURNING') &&
        !item.shipments.length
      ) {
        secondsInCirculation = endDate.getTime() - startDate.getTime();
      }

      const daysInCirculation =
        secondsInCirculation > 0
          ? Math.round(secondsInCirculation / (1000 * 60 * 60 * 24))
          : 0;
      const dailyCommission = calcDailyCommission(item.product.points);

      return {
        name: item.product.name,
        value: item.product.points,
        serial: item.serial,
        total: numeral(Number(daysInCirculation) * dailyCommission).format(
          '$0,0.00',
        ),
        contributorName: item.user.name,
        contributorEmail: item.user.email,
        contributorPhone: item.user.phone,
        daysInCirculation,
      };
    });

    const columns = {
      value: 'Product Value',
      total: 'Actual Total',
      serial: 'Serial',
      name: 'Product Name',
      contributorName: 'Contributor Name',
      contributorPhone: 'Contributor Phone',
      contributorEmail: 'Contributor Email',
      daysInCirculation: 'Days In Circulation',
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
