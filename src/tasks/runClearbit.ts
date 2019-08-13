import { Client } from 'clearbit';
import pick from 'lodash/pick';

import { User } from '../models/User';
import { UserVerification } from '../models/UserVerification';
import { UserEmployment } from '../models/UserEmployment';
import { UserSocialHandle } from '../models/UserSocialHandle';

const clearbit = new Client({ key: process.env.CLEARBIT });

export async function runClearbit(req, res) {
  const { ipAddress, userId } = req.body;

  if (userId && req.header('X-AppEngine-TaskName')) {
    const user = await User.findByPk(userId);

    const personFilter: {
      email: string;
      company?: string;
    } = {
      email: user.email,
    };

    if (user.businessName) {
      personFilter.company = user.businessName;
    }

    try {
      const person = await clearbit.Person.find(personFilter);

      Object.assign(user, pick(person, ['bio', 'site', 'avatar']));
      await user.save();

      if (person.employment) {
        await UserEmployment.create({
          ...pick(person.employment, [
            'domain',
            'name',
            'title',
            'role',
            'subRole',
            'seniority',
          ]),
        });
      }

      const socialHandles = [];

      if (person.facebook && person.facebook.handle) {
        socialHandles.push({
          handle: person.facebook.handle,
          type: 'FACEBOOK',
          userId: user.id,
        });
      }

      if (person.github && person.github.handle) {
        socialHandles.push({
          handle: person.github.handle,
          type: 'GITHUB',
          userId: user.id,
        });
      }

      if (person.twitter && person.twitter.handle) {
        socialHandles.push({
          handle: person.twitter.handle,
          type: 'TWITTER',
          userId: user.id,
        });
      }

      if (person.linkedin && person.linkedin.handle) {
        socialHandles.push({
          handle: person.linkedin.handle,
          type: 'LINKEDIN',
          userId: user.id,
        });
      }

      await UserSocialHandle.bulkCreate(socialHandles);

      await UserVerification.create({
        type: 'CLEARBIT_PERSON',
        verified: !person.fuzzy,
        meta: person,
        userId: user.id,
      });

      return res
        .send(`User clearbit account found: ${userId} ${person.id}`)
        .end();
    } catch (e) {
      await UserVerification.create({
        type: 'CLEARBIT_PERSON',
        verified: false,
        meta: e,
        userId: user.id,
      });
    }

    return res.send(`User clearbit verification failed`).end();
  }

  return res
    .status(500)
    .send('Not authorized')
    .end();
}
