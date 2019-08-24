import camelcaseKeys from 'camelcase-keys';
import Recurly from 'recurly';
import { Arg, Authorized, Ctx, Mutation, Resolver } from 'type-graphql';

import { BillingInformation } from '../classes/billingInformation';
import { SourceUpdateInput } from '../classes/sourceUpdate.input';
import { UserRole } from '../enums/userRole';
import { Address } from '../models/Address';
import { User } from '../models/User';
import { IContext } from '../utils/context.interface';

const recurly = new Recurly.Client(process.env.RECURLY, `subdomain-parachut`);

@Resolver()
export default class SourceResolver {
  @Authorized([UserRole.MEMBER])
  @Mutation(() => BillingInformation)
  public async sourceUpdate(
    @Arg('input', (type) => SourceUpdateInput)
    { token, firstName, lastName, addressId }: SourceUpdateInput,
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
          {
            association: 'address',
            where: {
              type: 'RECURLY',
            },
          },
        ],
      });

      const address = await Address.findByPk(addressId);

      const billingInformation = await recurly.updateBillingInfo(
        user.integrations[0].value,
        {
          firstName,
          lastName,
          tokenId: token,
          address: {
            firstName,
            lastName,
            phone: user.phone,
            street1: address.street,
            street2: `${address.secondaryUnit} ${address.secondaryNumber}`,
            city: address.city,
            region: address.state,
            postalCode: address.zip,
            country: address.country,
          },
        },
      );

      return {
        firstName,
        lastName,
        paymentMethod: camelcaseKeys(billingInformation.payment_method),
        address,
      };
    }

    throw new Error('Unauthorised');
  }
}
