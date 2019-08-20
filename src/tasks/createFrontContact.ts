import to from 'await-to-js';
import * as request from 'superagent';

import { User } from '../models/User';
import { UserIntegration } from '../models/UserIntegration';

const { FRONT_JWT_TOKEN } = process.env;

async function createFrontContact(job) {
  const { userId } = job.data;

  if (userId) {
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

      return `User front account created: ${userId} ${result.body.id}`;
    } else {
      const id = err.response.body._error.message
        .trim()
        .split(' ')
        .splice(-1)[0];

      return UserIntegration.create({
        type: 'FRONT',
        value: id.substring(0, id.length - 1),
        userId: user.id,
      });
    }
  }
}

export default createFrontContact;
