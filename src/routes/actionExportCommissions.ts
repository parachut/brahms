import express from 'express';
import Liana from 'forest-express-sequelize';
import { Op } from 'sequelize';
import fs from 'fs';
import stringify from 'csv-stringify';
import tmp from 'tmp';
import numeral from 'numeral';
import findLast from 'lodash/findLast';
import startOfDay from 'date-fns/startOfDay';
import endOfDay from 'date-fns/endOfDay';
import sortBy from 'lodash/sortBy';

import { calcDailyCommission } from '../utils/calc';
import { Inventory } from '../models/Inventory';
import { Shipment } from '../models/Shipment';
import { ShipmentType } from '../enums/shipmentType';
import { ShipmentDirection } from '../enums/shipmentDirection';

const router = express.Router();

router.post(
  '/actions/export-commissions',
  Liana.ensureAuthenticated,
  async (req, res) => {
    const { ids } = req.body.data.attributes;
    const attrs = req.body.data.attributes.values;

    const startDate = startOfDay(new Date(attrs['Start date']));
    const endDate = endOfDay(new Date(attrs['End date']));

    const items = await Inventory.findAll({
      where: ids && ids.length ? { id: { [Op.in]: ids } } : {},
      include: [
        'user',
        'product',
        {
          association: 'shipments',
          order: [['carrierReceivedAt', 'ASC']],
        },
      ],
    });

    const report = items.map((item) => {
      let lastOutbound: number = 0;

      const monthShipments = sortBy(
        item.shipments
          .filter((shipment) => shipment.type === ShipmentType.ACCESS)
          .filter((shipment) => {
            return (
              (shipment.carrierDeliveredAt &&
                (shipment.carrierDeliveredAt.getTime() > startDate.getTime() &&
                  shipment.carrierDeliveredAt.getTime() < endDate.getTime() &&
                  shipment.direction === ShipmentDirection.OUTBOUND)) ||
              (shipment.carrierReceivedAt &&
                (shipment.carrierReceivedAt.getTime() > startDate.getTime() &&
                  shipment.carrierReceivedAt.getTime() < endDate.getTime() &&
                  shipment.direction === ShipmentDirection.INBOUND))
            );
          }),
        [
          function(o) {
            return o.carrierReceivedAt.getTime();
          },
        ],
      );

      let secondsInCirculation = monthShipments.reduce((r: number, i: any) => {
        if (lastOutbound > 0 && i.direction === 'INBOUND') {
          return r + (i.carrierReceivedAt.getTime() - lastOutbound);
        } else if (i.direction === 'OUTBOUND') {
          lastOutbound = i.carrierDeliveredAt.getTime();
          return r;
        } else if (r === 0 && lastOutbound === 0 && i.direction === 'INBOUND') {
          return r + (i.carrierReceivedAt.getTime() - startDate.getTime());
        }
      }, 0);

      if (
        secondsInCirculation > 0 ||
        (secondsInCirculation === 0 && lastOutbound > 0)
      ) {
        const lastShipment = monthShipments[monthShipments.length - 1];
        if (
          lastShipment &&
          lastShipment.direction === ShipmentDirection.OUTBOUND
        ) {
          secondsInCirculation =
            secondsInCirculation + (endDate.getTime() - lastOutbound);
        }
      }

      if (secondsInCirculation === 0) {
        const prevousToShipment: Shipment = findLast(
          item.shipments.filter(
            (shipment) => shipment.type === ShipmentType.ACCESS,
          ),
          (shipment) =>
            shipment.carrierDeliveredAt &&
            shipment.carrierDeliveredAt.getTime() < startDate.getTime() &&
            shipment.direction === ShipmentDirection.OUTBOUND,
        );

        if (prevousToShipment) {
          const nextToShipment: Shipment = item.shipments
            .filter((shipment) => shipment.type === ShipmentType.ACCESS)
            .find(
              (shipment) =>
                shipment.userId === prevousToShipment.userId &&
                shipment.direction === ShipmentDirection.INBOUND &&
                (shipment.carrierReceivedAt &&
                  shipment.carrierReceivedAt.getTime() >
                    prevousToShipment.carrierDeliveredAt.getTime()),
            );

          if (
            (nextToShipment &&
              nextToShipment.carrierReceivedAt.getTime() > endDate.getTime()) ||
            !nextToShipment
          ) {
            secondsInCirculation = endDate.getTime() - startDate.getTime();
          }
        }
      }

      const daysInCirculation =
        secondsInCirculation > 0
          ? Math.ceil(secondsInCirculation / (1000 * 60 * 60 * 24))
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
      report.filter((item) => item.total !== '$0.00'),
      {
        header: true,
        columns,
      },
      function(err, data) {
        if (err) {
          return res.status(500).send(err);
        }

        tmp.file(function _tempFileCreated(err, path, fd, cleanupCallback) {
          if (err) throw err;

          fs.writeFileSync(path, data);

          let options = {
            dotfiles: 'deny',
            headers: {
              'Access-Control-Expose-Headers': 'Content-Disposition',
              'Content-Disposition': 'attachment; filename="commissions.csv"',
            },
          };

          res.sendFile(path, options, (error) => {
            if (error) {
              throw error;
            }
          });

          // If we don't need the file anymore we could manually call the cleanupCallback
          // But that is not necessary if we didn't pass the keep option because the library
          // will clean after itself.
          cleanupCallback();
        });
      },
    );
  },
);

module.exports = router;
