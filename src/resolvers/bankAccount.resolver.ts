import Dwolla from 'dwolla-v2';
import plaid from 'plaid';
import { Arg, Authorized, Ctx, Mutation, Query, Resolver } from 'type-graphql';

import { BankAccountCreateInput } from '../classes/bankAccountCreate.input';
import { BankAccountWhereInput } from '../classes/bankAccountWhere.input';
import { UserRole } from '../enums/userRole';
import { User } from '../models/User';
import { UserBankAccount } from '../models/UserBankAccount';
import { UserBankBalance } from '../models/UserBankBalance';
import { UserIntegration } from '../models/UserIntegration';
import { IContext } from '../utils/context.interface';

const plaidClient = new plaid.Client(
  process.env.PLAID_ID,
  process.env.PLAID_SECRET,
  process.env.PLAID_PUBLIC_KEY,
  plaid.environments.production,
);

const dwolla = new Dwolla.Client({
  key: process.env.DWOLLA_KEY,
  secret: process.env.DWOLLA_SECRET,
  environment: 'production',
});

@Resolver()
export default class BankAccountResolver {
  @Authorized([UserRole.MEMBER])
  @Query((returns) => [UserBankAccount])
  public async bankAccounts(
    @Arg('where', (type) => BankAccountWhereInput)
    where: BankAccountWhereInput,
    @Ctx() ctx: IContext,
  ) {
    if (ctx.user) {
      return UserBankAccount.findAll({
        where: {
          ...where,
          userId: ctx.user.id,
        },
        order: [['created_at', 'DESC']],
      });
    }

    throw new Error('Unauthorised');
  }

  @Authorized([UserRole.MEMBER])
  @Mutation(() => UserBankAccount)
  public async bankAccountCreate(
    @Arg('input', (type) => BankAccountCreateInput)
    { token, accountId }: BankAccountCreateInput,
    @Ctx() ctx: IContext,
  ) {
    if (ctx.user) {
      try {
        const appToken = await dwolla.auth.client();

        const {
          access_token: accessToken,
        } = await plaidClient.exchangePublicToken(token);

        const user = await User.findByPk(ctx.user.id, {
          include: ['integrations'],
        });

        let dwollaIntegration = user.integrations.find(
          (i) => i.type === 'DWOLLA',
        );

        if (!dwollaIntegration) {
          const dwollaCustomerRequest: any = {
            firstName: user.parsedName.first,
            lastName: user.parsedName.last,
            email: user.email,
            type: 'receive-only',
            ipAddress: ctx.clientIp,
          };

          if (user.businessName && user.businessName.length) {
            dwollaCustomerRequest.businessName = user.businessName;
          }

          const userUrl = await appToken
            .post('customers', dwollaCustomerRequest)
            .then((res) => res.headers.get('location'));

          dwollaIntegration = await UserIntegration.create({
            type: 'DWOLLA',
            value: userUrl,
            userId: ctx.user.id,
          } as UserIntegration);
        }

        await UserIntegration.create({
          type: 'PLAID',
          value: accessToken,
          userId: ctx.user.id,
        } as UserIntegration);

        let fundingSource = null;
        let userBankAccount = null;

        const { accounts } = await plaidClient.getAccounts(accessToken);

        if (accounts) {
          for (const account of accounts) {
            if (account.account_id === accountId) {
              try {
                const {
                  processor_token: plaidToken,
                } = await plaidClient.createProcessorToken(
                  accessToken,
                  accountId,
                  'dwolla',
                );

                fundingSource = await appToken
                  .post(`${dwollaIntegration.value}/funding-sources`, {
                    plaidToken,
                    name: account.name,
                  })
                  .then((res) => res.headers.get('location'));

                await UserBankAccount.update(
                  {
                    primary: false,
                  },
                  {
                    where: {
                      userId: ctx.user.id,
                    },
                  },
                );

                userBankAccount = await UserBankAccount.create({
                  accountId: account.account_id,
                  primary: true,
                  name: account.name,
                  mask: account.mask,
                  subtype: account.subtype,
                  userId: ctx.user.id,
                  plaidUrl: fundingSource,
                } as UserBankAccount);
              } catch (e) {
                console.log(e);
                fundingSource = JSON.parse(e)._links.about.href;
              }
            }
          }
        }

        try {
          const { accounts: accountBalances } = await plaidClient.getBalance(
            accessToken,
          );

          if (accountBalances) {
            for (const account of accountBalances) {
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
        } catch (e) {
          console.log(e);
        }

        return userBankAccount;
      } catch (e) {
        console.log(e);
        throw e;
      }
    }
    throw new Error('Unauthorised');
  }
}
