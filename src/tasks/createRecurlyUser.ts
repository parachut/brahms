import Recurly from 'recurly';

import { User } from '../models/User';
import { UserIntegration } from '../models/UserIntegration';

const recurly = new Recurly.Client(process.env.RECURLY, `subdomain-parachut`);

async function createRecurlyUser(job) {
  const { userId } = job.data;

  if (userId) {
    const user = await User.findByPk(userId);

    try {
      const customer = await recurly.createAccount({
        code: user.id,
        firstName: user.parsedName.first,
        lastName: user.parsedName.last,
        email: user.email,
      });

      const integration = await UserIntegration.create({
        type: 'RECURLY',
        value: customer.id,
        userId: user.id,
      });

      return integration;
    } catch (e) {
      console.log(e);

      return e;
    }
  }
}

export default createRecurlyUser;
