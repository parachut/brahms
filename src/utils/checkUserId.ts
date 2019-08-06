import { Op } from 'sequelize';
import { User } from '../models/User';

export async function checkUserId(req, payload, done) {
  const count = await User.count({
    where: {
      id: payload.id,
      roles: { [Op.contains]: payload.roles },
    },
  });

  return done(null, !count);
}
