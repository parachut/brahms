import plaid from 'plaid';
import Stripe from 'stripe';
import {
  Arg,
  Authorized,
  Ctx,
  FieldResolver,
  Mutation,
  Query,
  Resolver,
  Root,
} from 'type-graphql';

import { QueueCreateInput } from '../classes/queueCreate.input';
import { QueueWhereUniqueInput } from '../classes/queueWhereUnique.input';
import { SourceUpdateInput } from '../classes/sourceUpdate.input';
import { StripeSource } from '../classes/stripeSource';
import { UserRole } from '../enums/userRole';
import { CartItem } from '../models/CartItem';
import { Product } from '../models/Product';
import { User } from '../models/User';
import { UserBankBalance } from '../models/UserBankBalance';
import { UserIntegration } from '../models/UserIntegration';
import { IContext } from '../utils/context.interface';
import { formatStripeSource } from '../utils/formatStripeSource';

const plaidClient = new plaid.Client(
  process.env.PLAID_ID,
  process.env.PLAID_SECRET,
  process.env.PLAID_PUBLIC_KEY,
  process.env.NODE_ENV === 'production'
    ? plaid.environments.development
    : plaid.environments.sandbox,
);
const stripe = new Stripe(process.env.STRIPE);

@Resolver()
export default class SourceResolver {
  @Authorized([UserRole.MEMBER])
  @Mutation(() => StripeSource)
  public async sourceUpdate(
    @Arg('input', (type) => SourceUpdateInput)
    { token: stripeToken, accountId }: SourceUpdateInput,
    @Ctx() ctx: IContext,
  ) {
    if (ctx.user) {
      const user = await User.findByPk(ctx.user.id, {
        include: [
          'integrations',
          {
            association: 'carts',
            where: { completedAt: null, userId: ctx.user.id },
            limit: 1,
            attributes: ['id'],
            order: [['createdAt', 'DESC']],
          },
        ],
      });

      if (accountId) {
        try {
          const {
            access_token: accessToken,
          } = await plaidClient.exchangePublicToken(stripeToken);
          const stripeTokenRes = await plaidClient.createStripeToken(
            accessToken,
            accountId,
          );
          stripeToken = stripeTokenRes.stripe_bank_account_token;

          await UserIntegration.create({
            type: 'PLAID',
            value: accessToken,
            userId: ctx.user.id,
          });

          const { accounts } = await plaidClient.getBalance(accessToken);
          if (accounts) {
            for (const account of accounts) {
              await UserBankBalance.create({
                available: account.balances.available
                  ? Math.round(account.balances.available * 100)
                  : null,
                name: account.name,
                limit: account.balances.limit
                  ? Math.round(account.balances.limit * 100)
                  : null,
                current: Math.round(account.balances.current * 100),
              });
            }
          }
        } catch (e) {
          console.log(e);
        }
      }

      const newSource = await stripe.customers.createSource(user.stripeId, {
        source: stripeToken,
      });

      await stripe.customers.update(user.stripeId, {
        default_source: newSource.id,
      });

      if (newSource.object === 'card') {
        ctx.analytics.track({
          event: 'Payment Info Entered',
          properties: {
            checkout_id: user.carts[0].id,
            payment_method: newSource.brand,
          },
          userId: ctx.user.id,
        });
      }

      return formatStripeSource(newSource);
    }

    throw new Error('Unauthorized');
  }
}
