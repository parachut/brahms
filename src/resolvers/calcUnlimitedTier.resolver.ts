import { Op } from 'sequelize';
import Stripe from 'stripe';
import { Arg, Authorized, Ctx, Query, Resolver } from 'type-graphql';

import { Plans } from '../decorators/plans';
import { UserRole } from '../enums/userRole';
import { User } from '../models/User';
import { calcUnlimitedTier as calcUnlimitedTierCalc } from '../utils/calc';
import { IContext } from '../utils/context.interface';

const stripe = new Stripe(process.env.STRIPE);

@Resolver(User)
export default class CalcUnlimitedTierResolver {
  @Authorized([UserRole.MEMBER])
  @Query((returns) => User)
  public async calcUnlimitedTier(
    @Arg('plan', (type) => String) plan: string,
    @Plans() plans: Plans,
    @Ctx() ctx: IContext,
  ) {
    if (ctx.user) {
      let selectedPlan = plan as string;
      const user = await User.findByPk(ctx.user.id, {
        include: [
          {
            association: 'carts',
            where: { completedAt: null, user: ctx.user.id },
            include: [
              {
                association: 'items',
                include: ['product'],
              },
            ],
          },
          {
            association: 'currentInventory',
            where: {
              member: ctx.user.id,
              status: {
                [Op.in]: [
                  'SHIPMENTPREP',
                  'ENROUTEMEMBER',
                  'WITHMEMBER',
                  'RETURNING',
                ],
              },
            },
            include: ['product'],
          },
        ],
      });

      if (!plan) {
        selectedPlan = user.planId || '1500';
      }

      const cartPoints = user.carts[0].items.reduce(
        (r, ii) => r + ii.product.points * ii.quantity,
        0,
      );

      const currentPoints = user.currentInventory.reduce(
        (r, ii) => r + ii.product.points * 1,
        0,
      );

      let total = currentPoints + cartPoints;

      total = total < user.points ? user.points : total;

      let tier = calcUnlimitedTierCalc(total);

      if (parseInt(tier, 10) < parseInt(selectedPlan, 10)) {
        tier = selectedPlan;
      }

      const pointsOver =
        total > parseInt(selectedPlan, 10)
          ? total - parseInt(selectedPlan, 10)
          : 0;

      let upgradeCost = 0;

      const date = new Date();
      let nextBilling: string = new Date(
        date.setMonth(date.getMonth() + 1),
      ).toLocaleDateString('en-US');

      const stripeCustomer = user.integrations.find(
        (int) => int.type === 'STRIPE',
      );

      const stripeMonthlyPlan = user.integrations.find(
        (int) => int.type === 'STRIPE_MONTHLYPLAN',
      );

      const stripeUnlimitedTier = user.integrations.find(
        (int) => int.type === 'STRIPE_MONTHLYUNLIMITEDTIER',
      );

      const stripeMonthlyProtectionPlan = user.integrations.find(
        (int) => int.type === 'STRIPE_MONTHLYPROTECTIONPLAN',
      );

      if (
        (user.planId && user.planId !== selectedPlan) ||
        (user.planId && pointsOver)
      ) {
        const prorationDate = Math.floor(Date.now() / 1000);

        const items: any = [
          {
            id: stripeUnlimitedTier.value,
            plan: tier, // Switch to new plan,
            quantity: total,
          },
        ];

        if (stripeMonthlyProtectionPlan) {
          items.push({
            id: stripeMonthlyProtectionPlan.value,
            quantity: 1,
          });
        }

        const invoice = await stripe.invoices.retrieveUpcoming(
          stripeCustomer.value,
          stripeMonthlyPlan.value,
          {
            subscription_items: items,
            subscription_proration_date: prorationDate,
          } as any,
        );

        const currentProrations = [];

        invoice.lines.data.forEach((invoiceItem) => {
          if (invoiceItem.period.start === prorationDate) {
            currentProrations.push(invoiceItem);
            upgradeCost += invoiceItem.amount;
          }
        });

        nextBilling = new Date(1000 * invoice.period_end).toLocaleDateString(
          'en-US',
        );
      } else if (stripeMonthlyPlan) {
        const stripeSub = await stripe.subscriptions.retrieve(
          stripeMonthlyPlan.value,
        );

        nextBilling = new Date(
          1000 * stripeSub.current_period_end,
        ).toLocaleDateString('en-US');
      }

      return {
        cartPoints,
        currentPoints,
        id: selectedPlan,
        monthly: plans[selectedPlan],
        nextBilling,
        overage: 0.1 * pointsOver,
        points: total,
        pointsOver,
        recommended: tier,
        total: plans[selectedPlan] + pointsOver * 0.1,
        upgradeCost: upgradeCost / 100,
      };
    }
    throw new Error('User not found');
  }
}
