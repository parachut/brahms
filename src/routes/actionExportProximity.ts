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
import { User } from '../models/User';
import { Shipment } from '../models/Shipment';
import { ShipmentType } from '../enums/shipmentType';
import { ShipmentDirection } from '../enums/shipmentDirection';

const router = express.Router();

router.post(
  '/actions/export-proximity',
  Liana.ensureAuthenticated,
  async (req, res) => {
    const { ids } = req.body.data.attributes;

    const users = await User.findAll({
      include: [
        {
          association: 'carts',
          include: [
            {
              association: 'items',
              include: ['product'],
            },
          ],
        },
        'addresses',
      ],
    });

    const report = users
      .filter((user) => {
        const cart = user.carts.find((cart) => !cart.completedAt);
        return cart && cart.items.length;
      })
      .map((user) => {
        const cart = user.carts.find((cart) => !cart.completedAt);

        const cartItemsSorted = sortBy(cart.items, function(item) {
          return item.updatedAt;
        });

        let proximity = user.addresses.length ? 1 : 0;
        proximity += user.planId ? 1 : 0;

        return {
          name: user.name,
          email: user.email,
          phone: user.phone,
          lastCartAdd: new Date(
            cartItemsSorted[0].updatedAt,
          ).toLocaleDateString('en-US'),
          cartValue: numeral(
            cart.items.reduce((r, i) => r + i.product.points, 0),
          ).format('$0,0.00'),
          cartItems: cart.items.map((i) => i.product.name).join(', '),
          proximity,
        };
      });

    const columns = {
      name: 'Name',
      email: 'Email',
      phone: 'Phone',
      cartValue: 'Cart Value',
      cartItems: 'Cart Items',
      proximity: 'Proximity',
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

        tmp.file(function _tempFileCreated(err, path, fd, cleanupCallback) {
          if (err) throw err;

          fs.writeFileSync(path, data);

          let options = {
            dotfiles: 'deny',
            headers: {
              'Access-Control-Expose-Headers': 'Content-Disposition',
              'Content-Disposition':
                'attachment; filename="user-proximity.csv"',
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
