import Recurly from 'recurly';

import { User } from '../models/User';
import { UserIntegration } from '../models/UserIntegration';

const recurly = new Recurly.Client(process.env.RECURLY, `subdomain-parachut`);

export async function createRecurlyUser(
  user: User,
): Promise<Partial<UserIntegration>> {
  const customer = await recurly.createAccount({
    code: user.id,
    firstName: user.parsedName.first,
    lastName: user.parsedName.last,
    email: user.email,
  });

  return {
    type: 'RECURLY',
    value: customer.id,
    userId: user.get('id'),
  };
}
