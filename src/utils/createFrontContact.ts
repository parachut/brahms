import to from 'await-to-js';
import * as request from 'superagent';

import { User } from '../models/User';
import { UserIntegration } from '../models/UserIntegration';

const { FRONT_JWT_TOKEN } = process.env;

export async function createFrontContact(
  user: User,
): Promise<Partial<UserIntegration>> {
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
    return {
      type: 'FRONT',
      value: result.body.id,
      userId: user.get('id'),
    };
  } else {
    const id = err.response.body._error.message
      .trim()
      .split(' ')
      .splice(-1)[0];

    return {
      type: 'FRONT',
      value: id.substring(0, id.length - 1),
      userId: user.get('id'),
    };
  }
}
