import to from 'await-to-js';
import * as request from 'superagent';

import { User } from '../models/User';
import { NewUserIntegration } from './newUserIntegration.interface';

const { FRONT_JWT_TOKEN } = process.env;

export async function createFrontContact(
  user: User,
): Promise<NewUserIntegration> {
  let err: any;
  let res: any;

  [err, res] = await to(
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
    return {
      type: 'FRONT',
      value: res.body.id,
      userId: user.id,
    };
  } else {
    const id = err.response.body._error.message
      .trim()
      .split(' ')
      .splice(-1)[0];

    return {
      type: 'FRONT',
      value: id.substring(0, id.length - 1),
      userId: user.id,
    };
  }
}
