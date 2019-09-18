import camelcaseKeys from 'camelcase-keys';
import plaid from 'plaid';
import { Arg, Authorized, Ctx, Mutation, Query, Resolver } from 'type-graphql';

import { BankAccountCreateInput } from '../classes/bankAccountCreate.input';
import { UserRole } from '../enums/userRole';
import { UserBankAccount } from '../models/UserBankAccount';
import { UserBankBalance } from '../models/UserBankBalance';
import { UserIntegration } from '../models/UserIntegration';
import { IContext } from '../utils/context.interface';

const plaidClient = new plaid.Client(
  process.env.PLAID_ID,
  process.env.PLAID_SECRET,
  process.env.PLAID_PUBLIC_KEY,
  process.env.NODE_ENV === 'production'
    ? plaid.environments.development
    : plaid.environments.sandbox,
);

@Resolver()
export default class BankAccountResolver {
  @Authorized([UserRole.MEMBER])
  @Query((returns) => [UserBankAccount])
  public async bankAccounts(@Ctx() ctx: IContext) {
    if (ctx.user) {
      return UserBankAccount.findAll({
        where: {
          userId: ctx.user.id,
        },
      });
    }

    throw new Error('Unauthorised');
  }

  @Authorized([UserRole.MEMBER])
  @Mutation(() => Boolean)
  public async bankAccountCreate(
    @Arg('input', (type) => BankAccountCreateInput)
    { token, accountId }: BankAccountCreateInput,
    @Ctx() ctx: IContext,
  ) {
    if (ctx.user) {
      try {
        const {
          access_token: accessToken,
        } = await plaidClient.exchangePublicToken(token);

        await UserIntegration.create({
          type: 'PLAID',
          value: accessToken,
          userId: ctx.user.id,
        } as UserIntegration);

        const { accounts } = await plaidClient.getBalance(accessToken);
        if (accounts) {
          for (const account of accounts) {
            await UserBankAccount.create({
              accountId: account.account_id,
              primary: account.account_id === accountId,
              name: account.official_name,
              mask: account.mask,
              subtype: account.subtype,
              userId: ctx.user.id,
            } as UserBankAccount);

            await UserBankBalance.create({
              available: account.balances.available
                ? Math.round(account.balances.available * 100)
                : null,
              name: account.name,
              limit: account.balances.limit
                ? Math.round(account.balances.limit * 100)
                : null,
              current: Math.round(account.balances.current * 100),
              userId: ctx.user.id,
            } as UserBankBalance);
          }
        }

        return true;
      } catch (e) {
        console.log(e);
        throw e;
      }
    }
    throw new Error('Unauthorised');
  }
}
