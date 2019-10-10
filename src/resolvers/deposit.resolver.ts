import Dwolla from 'dwolla-v2';
import { Arg, Authorized, Ctx, Mutation, Query, Resolver } from 'type-graphql';

import { DepositCreateInput } from '../classes/DepositCreate.input';
import { UserRole } from '../enums/userRole';
import { Deposit } from '../models/Deposit';
import { User } from '../models/User';
import { IContext } from '../utils/context.interface';

const dwolla = new Dwolla.Client({
  key: process.env.DWOLLA_KEY,
  secret: process.env.DWOLLA_SECRET,
  environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox',
});

@Resolver()
export default class DepositResolver {
  @Authorized([UserRole.MEMBER])
  @Query((returns) => [Deposit])
  public async deposits(@Ctx() ctx: IContext) {
    if (ctx.user) {
      return Deposit.findAll({
        where: {
          userId: ctx.user.id,
        },
        order: [['created_at', 'DESC']],
      });
    }

    throw new Error('Unauthorised');
  }

  @Authorized([UserRole.MEMBER])
  @Mutation(() => Deposit)
  public async depositCreate(
    @Arg('input', (type) => DepositCreateInput)
    { amount }: DepositCreateInput,
    @Ctx() ctx: IContext,
  ) {
    if (ctx.user) {
      try {
        const user = await User.findByPk(ctx.user.id, {
          include: ['bankAccounts', 'incomes', 'deposits'],
        });

        const totalIncome = user.incomes.reduce((r, i) => r + i.commission, 0);
        const totalDeposited = user.deposits.reduce((r, i) => r + i.amount, 0);

        const available = totalIncome - totalDeposited;

        if (available < amount) {
          throw new Error(
            'You are attempting to transfer more than is available.',
          );
        }

        const appToken = await dwolla.auth.client();

        const accountUrl = await appToken
          .get('/')
          .then((res) => res.body._links.account.href);

        const masterFundingSource = await appToken
          .get(`${accountUrl}/funding-sources`)
          .then(
            (res) => res.body._embedded['funding-sources'][0]._links.self.href,
          );

        const bankAccount = user.bankAccounts.find(
          (account) => account.primary,
        );

        const deposit = await Deposit.create({
          amount,
          userId: ctx.user.id,
          userBankAccountId: bankAccount.id,
        });

        var requestBody = {
          _links: {
            source: {
              href: masterFundingSource,
            },
            destination: {
              href: bankAccount.plaidUrl,
            },
          },
          amount: {
            currency: 'USD',
            value: amount.toFixed(2),
          },
          metadata: {
            paymentId: deposit.get('id'),
            userId: user.get('id'),
            note: 'Deposit initiated by contributor.',
          },
          clearing: {
            destination: 'next-available',
          },
          correlationId: deposit.get('id'),
        };

        const plaidUrl = await appToken
          .post('transfers', requestBody)
          .then((res) => res.headers.get('location'));

        deposit.plaidUrl = plaidUrl;
        await deposit.save();

        return deposit;
      } catch (e) {
        console.log(e);
        throw e;
      }
    }
    throw new Error('Unauthorised');
  }
}
