import Stripe from 'stripe';

import { User } from '../models/User';
import { NewUserIntegration } from './newUserIntegration.interface';

if (!process.env.STRIPE) {
  throw new Error('Missing environment variable STRIPE');
}

const stripe = new Stripe(process.env.STRIPE);

export async function createStripeUser(
  user: User,
): Promise<NewUserIntegration> {
  const customer = await stripe.customers.create({
    description: user.name,
    email: user.email,
  });

  user.stripeId = customer.id;

  return {
    type: 'STRIPE',
    value: customer.id,
    userId: user.id,
  };
}
