import Stripe from 'stripe';

import { User } from '../models/User';
import { UserIntegration } from '../models/UserIntegration';

if (!process.env.STRIPE) {
  throw new Error('Missing environment variable STRIPE');
}

const stripe = new Stripe(process.env.STRIPE);

export async function createStripeUser(req, res) {
  const { userId } = req.body;

  if (userId && req.header('X-AppEngine-TaskName')) {
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

    return res
      .send(`User stripe account created: ${userId} ${customer.id}`)
      .end();
  }

  return res
    .status(500)
    .send('Not authorized')
    .end();
}
