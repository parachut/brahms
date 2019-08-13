import { Op } from 'sequelize';
import Stripe from 'stripe';
import { Arg, Authorized, Ctx, Query, Resolver } from 'type-graphql';

import { CalcUnlimitedTier } from '../classes/calcUnlimitedTier';
import { Plans } from '../decorators/plans';
import { UserRole } from '../enums/userRole';
import { InventoryStatus } from '../enums/inventoryStatus';
import { Inventory } from '../models/Inventory';
import { User } from '../models/User';
import { calcUnlimitedTier as calcUnlimitedTierCalc } from '../utils/calc';
import { IContext } from '../utils/context.interface';

const stripe = new Stripe(process.env.STRIPE);

@Resolver(CalcUnlimitedTier)
export default class CalcUnlimitedTierResolver {
  @Authorized([UserRole.MEMBER])
  @Query((returns) => CalcUnlimitedTier)
  public async calcUnlimitedTier(@Plans() plans: Plans, @Ctx() ctx: IContext) {
    if (ctx.user) {
      let nextBilling = new Date();
      nextBilling = new Date(nextBilling.setMonth(nextBilling.getMonth() + 1));

      const [user, currentInventory] = await Promise.all([
        User.findByPk(ctx.user.id, {
          include: [
            {
              association: 'carts',
              where: { completedAt: null, userId: ctx.user.id },
              include: [
                {
                  association: 'items',
                  include: [
                    {
                      association: 'product',
                      attributes: ['id', 'points'],
                    },
                  ],
                },
              ],
            },
            'integrations',
          ],
        }),
        Inventory.findAll({
          where: {
            memberId: ctx.user.id,
            status: {
              [Op.in]: [
                InventoryStatus.SHIPMENTPREP,
                InventoryStatus.ENROUTEMEMBER,
                InventoryStatus.WITHMEMBER,
                InventoryStatus.RETURNING,
              ],
            },
          },
          include: [
            {
              association: 'product',
              attributes: ['id', 'points'],
            },
          ],
        }),
      ]);

      const selectedPlan = user.carts[0].planId || user.planId || '1500';

      const cartPoints = user.carts[0].items.reduce(
        (r, ii) => r + ii.product.points * ii.quantity,
        0,
      );

      const currentPoints = currentInventory.reduce(
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

      console.log(user.planId, pointsOver);

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
            plan: 'monthlyprotectionplan',
            quantity: 1,
          });
        }

        const invoice = await stripe.invoices.retrieveUpcoming({
          customer: stripeCustomer.value,
          subscription: stripeMonthlyPlan.value,
          subscription_items: items,
          subscription_proration_date: prorationDate,
        } as any);

        const currentProrations = [];

        invoice.lines.data.forEach((invoiceItem) => {
          if (invoiceItem.period.start === prorationDate) {
            currentProrations.push(invoiceItem);
            upgradeCost += invoiceItem.amount;
          }
        });

        nextBilling = new Date(1000 * invoice.period_end);
      } else if (stripeMonthlyPlan) {
        const stripeSub = await stripe.subscriptions.retrieve(
          stripeMonthlyPlan.value,
        );

        nextBilling = new Date(1000 * stripeSub.current_period_end);
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
