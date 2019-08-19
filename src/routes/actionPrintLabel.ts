import express from 'express';
import Liana from 'forest-express-sequelize';
import fetch from 'node-fetch';
import { Op } from 'sequelize';

import { Shipment } from '../models/Shipment';

const router = express.Router();

router.post(
  '/actions/print-label',
  Liana.ensureAuthenticated,
  async (req, res) => {
    let { ids } = req.body.data.attributes;

    const shipments = await Shipment.findAll({
      where: { id: { [Op.in]: ids } },
    });

    for (const shipment of shipments) {
      const body = {
        printerId: 69013352,
        title: 'Shipping Label for ' + shipment.id,
        contentType: 'raw_uri',
        content: shipment.labelUrlZPL,
        source: 'EasyPost',
        expireAfter: 600,
        options: {},
      };

      const response = await fetch('https://api.printnode.com/printjobs', {
        method: 'post',
        body: JSON.stringify(body),
        headers: {
          'Content-Type': 'application/json',
          Authorization:
            'Basic ' +
            Buffer.from('39duKfjG0etJ4YeQCk7WsHj2k_blwriaj9F-VPIBB5g').toString(
              'base64',
            ),
        },
      });

      console.log(response);

      res.send({ success: 'Label(s) are printing!' });
    }
  },
);

module.exports = router;
