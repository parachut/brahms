import express from 'express';
import Liana from 'forest-express-sequelize';
import { ShipKit } from '../models/ShipKit';
const router = express.Router();

router.post(
  '/actions/create-shipkit',
  Liana.ensureAuthenticated,
  async (req, res) => {
    const { ids } = req.body.data.attributes;
    const attrs = req.body.data.attributes.values;

    const airbox = Boolean(attrs['Airbox']);

    const shipKit = new ShipKit({
      userId: ids[0],
      airbox,
    });

    shipKit.completedAt = new Date();

    await shipKit.save();

    res.send({
      success: 'Shipkit generated successfully.',
      refresh: { relationships: ['shipKits'] },
    });
  },
);

module.exports = router;
