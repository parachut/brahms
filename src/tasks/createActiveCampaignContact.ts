import AC from 'activecampaign-rest';
import to from 'await-to-js';
import * as request from 'superagent';

import { User } from '../models/User';
import { UserIntegration } from '../models/UserIntegration';

const { ACTIVE_CAMPAIGN_URL, ACTIVE_CAMPAIGN_KEY } = process.env;

let contact = new AC.Contact({
  url: ACTIVE_CAMPAIGN_URL,
  token: ACTIVE_CAMPAIGN_KEY,
});

async function createActiveCampaignContact(job, cb) {
  const { userId } = job.data;

  if (userId) {
    const user = await User.findByPk(userId);

    let payload = {
      firstName: user.parsedName.first,
      lastName: user.parsedName.last,
      email: user.email,
      phone: user.phone,
    };

    contact.sync(payload, async (err, res) => {
      if (err) {
        console.log(err);
      }

      await UserIntegration.create({
        type: 'FRONT',
        value: res._id,
        userId: user.id,
      });

      [err] = await to(
        request
          .post('https://youraccountname.api-us1.com/api/3/contactLists')
          .send({
            contactList: {
              list: 1,
              contact: res._id,
              status: 1,
            },
          })
          .set('Api-Token', ACTIVE_CAMPAIGN_KEY)
          .set('accept', 'application/json'),
      );

      [err] = await to(
        request
          .post('https://youraccountname.api-us1.com/api/3/contactTags')
          .send({
            contactTag: {
              contact: res._id,
              tag: 3,
            },
          })
          .set('Api-Token', ACTIVE_CAMPAIGN_KEY)
          .set('accept', 'application/json'),
      );

      cb(`User active campaign account created: ${user.id} ${res.id}`);
    });
  }
}

export default createActiveCampaignContact;
