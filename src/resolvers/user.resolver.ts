import crypto from 'crypto';
import Stripe from 'stripe';
import { Ctx, FieldResolver, Resolver, Root } from 'type-graphql';

import { StripeSource } from '../classes/stripeSource';
import { Inventory } from '../models/Inventory';
import { User } from '../models/User';
import { UserIntegration } from '../models/UserIntegration';
import { UserVerification } from '../models/UserVerification';
import { IContext } from '../utils/context.interface';
import { formatStripeSource } from '../utils/formatStripeSource';

const stripe = new Stripe(process.env.STRIPE);

@Resolver(User)
export default class UserResolver {
  @FieldResolver((type) => [Inventory])
  async currentInventory(@Root() user: User): Promise<Inventory[]> {
    return ((await user.$get<Inventory>('currentInventory')) as Inventory[])!;
  }

  @FieldResolver((type) => [Inventory])
  async inventory(@Root() user: User): Promise<Inventory[]> {
    return ((await user.$get<Inventory>('inventory')) as Inventory[])!;
  }

  @FieldResolver((type) => Boolean)
  async identificationVerified(@Root() user: User): Promise<Boolean> {
    const verifications = (await user.$get<UserVerification>(
      'verifications',
    )) as UserVerification[];

    if (verifications.length) {
      const identity = verifications.find((v) => v.type === 'IDENTITY');

      if (identity) {
        return identity.verified;
      }
    }

    return false;
  }

  @FieldResolver((type) => String)
  frontHash(@Root() user: User): string {
    if (!process.env.FRONT_CHAT_SECRET) {
      throw new Error('Missing environment variable STRIPE');
    }

    return crypto
      .createHmac('sha256', process.env.FRONT_CHAT_SECRET)
      .update(user.email)
      .digest('hex');
  }

  @FieldResolver((type) => Boolean)
  async protectionPlan(@Root() user: User): Promise<boolean> {
    const integrations = (await user.$get<UserIntegration>(
      'integrations',
    )) as UserIntegration[];

    return !!integrations.find(
      (int) => int.type === 'STRIPE_MONTHLYPROTECTIONPLAN',
    );
  }

  @FieldResolver((type) => [StripeSource])
  async sources(@Ctx() ctx: IContext, @Root() user: User): Promise<any[]> {
    if (!user.stripeId) {
      return [];
    }
    const redisId = [user.id, 'stripe-sources'].join(':');
    const cacheItem = await ctx.redis.get(redisId);
    let sources: any = cacheItem ? JSON.parse(cacheItem) : null;

    if (!sources) {
      const stripeCustomer = await stripe.customers.retrieve(user.stripeId);
      if (
        !stripeCustomer ||
        !stripeCustomer.sources ||
        !stripeCustomer.sources.total_count
      ) {
        return [];
      }

      sources = stripeCustomer.sources.data;

      await ctx.redis.set(redisId, JSON.stringify(sources));

      /* This is on purpose due to @types/stripe being wrong */
    }

    return sources.map((source) => {
      return formatStripeSource(source);
    });
  }
}
