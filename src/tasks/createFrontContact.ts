import to from 'await-to-js';
import * as request from 'superagent';

import { User } from '../models/User';
import { UserIntegration } from '../models/UserIntegration';

const { FRONT_JWT_TOKEN } = process.env;

export async function createFrontContact(req, res) {
  const { userId } = req.body;

  if (userId && req.header('X-AppEngine-TaskName')) {
    const user = await User.findByPk(userId, { include: ['integrations'] });

    let err: any;
    let result: any;

    [err, result] = await to(
      request
        .post('https://api2.frontapp.com/contacts')
        .send({
          handles: [
            {
              handle: user.phone,
              source: 'phone',
            },
            {
              handle: user.email,
              source: 'email',
            },
          ],
          name: user.name,
        })
        .set('Authorization', `Bearer ${FRONT_JWT_TOKEN}`)
        .set('accept', 'application/json'),
    );

    if (!err) {
      await UserIntegration.create({
        type: 'FRONT',
        value: result.body.id,
        userId: user.id,
      });

      return res
        .send(`User front account created: ${userId} ${result.body.id}`)
        .end();
    } else {
      const id = err.response.body._error.message
        .trim()
        .split(' ')
        .splice(-1)[0];

      await UserIntegration.create({
        type: 'FRONT',
        value: id.substring(0, id.length - 1),
        userId: user.id,
      });

      return res
        .send(
          `User front account linked: ${userId} ${id.substring(
            0,
            id.length - 1,
          )}`,
        )
        .end();
    }
  }

  return res
    .status(500)
    .send('Not authorized')
    .end();
}
