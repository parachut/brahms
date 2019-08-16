import Stripe from 'stripe';

import { User } from '../models/User';
import { UserIntegration } from '../models/UserIntegration';

if (!process.env.STRIPE) {
  throw new Error('Missing environment variable STRIPE');
}

const stripe = new Stripe(process.env.STRIPE);

async function createStripeUser(job) {
  const { userId } = job.data;

  if (userId) {
    const user = await User.findByPk(userId, { include: ['integrations'] });

    const customer = await stripe.customers.create({
      description: user.name,
      email: user.email,
    });

    user.stripeId = customer.id;

    await user.save();
    await UserIntegration.create({
      type: 'STRIPE',
      value: customer.id,
      userId: user.id,
    });

    return `User stripe account created: ${userId} ${customer.id}`;
  }
}

export default createStripeUser;
