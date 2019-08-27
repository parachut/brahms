import camelcaseKeys from 'camelcase-keys';
import Recurly from 'recurly';
import { Arg, Authorized, Ctx, Mutation, Query, Resolver } from 'type-graphql';

import { PaymentInformation } from '../classes/paymentInformation';
import { PaymentInformationUpdateInput } from '../classes/paymentInformationUpdate.input';
import { UserRole } from '../enums/userRole';
import { UserIntegration } from '../models/UserIntegration';
import { User } from '../models/User';
import { IContext } from '../utils/context.interface';

const recurly = new Recurly.Client(process.env.RECURLY, `subdomain-parachut`);

@Resolver()
export default class PaymentInformationResolver {
  @Authorized([UserRole.MEMBER])
  @Query((returns) => PaymentInformation, { nullable: true })
  public async paymentInformation(@Ctx() ctx: IContext) {
    if (ctx.user) {
      const recurlyIntegration = await UserIntegration.findOne({
        where: {
          type: 'RECURLY',
          userId: ctx.user.id,
        },
      });

      try {
        const billingInfo = await recurly.getBillingInfo(
          recurlyIntegration.value,
        );

        return {
          ...camelcaseKeys(billingInfo),
          paymentMethod: camelcaseKeys(billingInfo.paymentMethod),
        };
      } catch (e) {
        return null;
      }
    }
    throw new Error('Unauthorised');
  }

  @Authorized([UserRole.MEMBER])
  @Mutation(() => PaymentInformation)
  public async paymentInformationUpdate(
    @Arg('input', (type) => PaymentInformationUpdateInput)
    { token }: PaymentInformationUpdateInput,
    @Ctx() ctx: IContext,
  ) {
    if (ctx.user) {
      const user = await User.findByPk(ctx.user.id, {
        include: [
          {
            association: 'integrations',
            where: {
              type: 'RECURLY',
            },
          },
        ],
      });

      const billingInformation = await recurly.updateBillingInfo(
        user.integrations[0].value,
        {
          tokenId: token,
        },
      );

      return {
        ...billingInformation,
        paymentMethod: camelcaseKeys(billingInformation.paymentMethod),
      };
    }

    throw new Error('Unauthorised');
  }
}
