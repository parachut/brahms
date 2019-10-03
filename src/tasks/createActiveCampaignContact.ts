import ActiveCampaign from 'activecampaign';

import { User } from '../models/User';
import { UserIntegration } from '../models/UserIntegration';

const { ACTIVE_CAMPAIGN_URL, ACTIVE_CAMPAIGN_KEY } = process.env;

const ac = new ActiveCampaign(ACTIVE_CAMPAIGN_URL, ACTIVE_CAMPAIGN_KEY);

async function createActiveCampaignContact(job) {
  const { userId } = job.data;

  if (userId) {
    const user = await User.findByPk(userId);

    const newAC = await ac.api('contact/add', {
      first_name: user.parsedName.first,
      last_name: user.parsedName.last,
      email: user.email,
      phone: user.phone,
      tags: 'access',
    });

    if (newAC.id) {
      await ac.api('contact/edit?email=' + user.email, {
        id: newAC.id,
        'p[1]': 1,
        'status[1]': 1,
      });
    }

    await UserIntegration.create({
      type: 'FRONT',
      value: newAC.id,
      userId: user.id,
    });

    return `User active campaign account created: ${userId} ${newAC.id}`;
  }
}

export default createActiveCampaignContact;
