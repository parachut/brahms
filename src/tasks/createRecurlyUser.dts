import Recurly from 'recurly';

import { User } from '../models/User';
import { UserIntegration } from '../models/UserIntegration';

const myApiKey = process.env.RECURLY;
const mySubdomain = 'parachut';
const recurly = new Recurly.Client(myApiKey, `subdomain-${mySubdomain}`);

async function createRecurlyUser(job) {
  const { userId } = job.data;

  if (userId) {
    const user = await User.findByPk(userId, { include: ['integrations'] });

    const customer = await recurly.createAccount({
      code: user.id,
      firstName: user.parsedName.first,
      lastName: user.parsedName.last,
      email: user.email,
      phone: user.phone,
    });

    user.recurlyId = customer.id;

    await user.save();
    const integration = await UserIntegration.create({
      type: 'STRIPE',
      value: customer.id,
      userId: user.id,
      email: user.email,
      phone: user.phone,
    });

    return integration;
  }
}

export default createRecurlyUser;
