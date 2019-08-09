import ipstack from 'ipstack';
import util from 'util';

import { User } from '../models/User';
import { UserGeolocation } from '../models/UserGeolocation';

const ipStack = util.promisify(ipstack);

export async function updateUserGeolocation(req, res) {
  const { userId, ipAddress } = req.body;

  if (userId && ipAddress && req.header('X-AppEngine-TaskName')) {
    const user = await User.findByPk(userId, {
      include: ['geolocations'],
    });

    if (!user.geolocations.find((geo) => geo.ip === ipAddress)) {
      const ipInfo = await ipStack(ipAddress, process.env.IPSTACK);

      await UserGeolocation.create({
        ip: ipAddress,
        type: ipInfo.type,
        countryCode: ipInfo.country_code,
        regionCode: ipInfo.region_code,
        city: ipInfo.city,
        zip: ipInfo.zip,
        coordinates: {
          type: 'Point',
          coordinates: [ipInfo.longitude, ipInfo.latitude],
        },
        userId,
      });
    }

    return res.send(`User geolocation updated: ${userId} ${ipAddress}`).end();
  }

  return res
    .status(500)
    .send('Not authorized')
    .end();
}
