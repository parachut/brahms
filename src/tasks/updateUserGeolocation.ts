import ipstack from "ipstack";
import util from "util";

import { User } from "@common/models/User";
import { UserGeolocation } from "@common/models/UserGeolocation";

const ipStack = util.promisify(ipstack);

async function updateUserGeolocation(job) {
  const { userId, ipAddress } = job.data;

  if (userId && ipAddress) {
    const user = await User.findByPk(userId, {
      include: ["geolocations"]
    });

    if (!user.geolocations.find(geo => geo.ip === ipAddress)) {
      const ipInfo = await ipStack(ipAddress, process.env.IPSTACK);

      await UserGeolocation.create({
        ip: ipAddress,
        type: ipInfo.type,
        countryCode: ipInfo.country_code,
        regionCode: ipInfo.region_code,
        city: ipInfo.city,
        zip: ipInfo.zip,
        coordinates: {
          type: "Point",
          coordinates: [ipInfo.longitude, ipInfo.latitude]
        },
        userId
      });
    }

    return `User geolocation updated: ${userId} ${ipAddress}`;
  }
}

export default updateUserGeolocation;
