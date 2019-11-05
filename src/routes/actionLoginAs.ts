import express from 'express';
import Liana from 'forest-express-sequelize';
import { User } from '../models/User';
import jsonwebtoken from 'jsonwebtoken';
import fs from 'fs';
import { signOptions } from '../../certs';

const router = express.Router();

router.post(
  '/actions/login-as',
  Liana.ensureAuthenticated,
  async (req, res) => {
    const { ids } = req.body.data.attributes;

    const user = await User.findOne({
      where: {
        id: ids[0],
      },
    });

    const token = jsonwebtoken.sign(
      {
        id: user.id,
        roles: user.roles,
      },
      fs.readFileSync('../../certs/private.key', 'utf8'),
      signOptions,
    );

    res.send({
      success: 'Generated token success.',
      redirectTo:
        'https://www.parachut.co/?temp_token=' + encodeURIComponent(token),
    });
  },
);

module.exports = router;
