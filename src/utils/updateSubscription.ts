import Stripe from 'stripe';

import { CartItem } from '../models/CartItem';
import { Inventory } from '../models/Inventory';
import { User } from '../models/User';
import { UserIntegration } from '../models/UserIntegration';

const stripe = new Stripe(process.env.STRIPE);

export async function updateSubscription(
  plan: string,
  user: User,
  currentInventory: Inventory[],
): Promise<any> {
  let integrations: UserIntegration[] = [];

  const [cart] = user.carts;

  const total = [...cart.items, ...currentInventory].reduce(
    (r, i) => r + i.product.points * (i instanceof CartItem ? i.quantity : 1),
    0,
  );

  const stripeCustomer = user.integrations.find((int) => int.type === 'STRIPE');

  const stripeMonthlyPlan = user.integrations.find(
    (int) => int.type === 'STRIPE_MONTHLYPLAN',
  );

  const stripeUnlimitedTier = user.integrations.find(
    (int) => int.type === 'STRIPE_MONTHLYUNLIMITEDTIER',
  );

  const stripeMonthlyProtectionPlan = user.integrations.find(
    (int) => int.type === 'STRIPE_MONTHLYPROTECTIONPLAN',
  );

  const items: any[] = [
    {
      plan,
      quantity: total > (user.points || 0) ? total : user.points,
    },
  ];

  if (stripeUnlimitedTier) {
    items[0].id = stripeUnlimitedTier.value;
  }

  if (stripeMonthlyProtectionPlan || cart.protectionPlan) {
    items.push({
      plan: 'monthlyprotectionplan',
      quantity: 1,
    });

    if (stripeMonthlyProtectionPlan) {
      items[1].id = stripeMonthlyProtectionPlan.value;
    }
  }

  let stripeSub;

  if (user.planId) {
    stripeSub = await stripe.subscriptions.update(stripeMonthlyPlan.value, {
      items,
    });

    if (!stripeMonthlyProtectionPlan && cart.protectionPlan) {
      integrations.push({
        type: 'STRIPE_MONTHLYPROTECTIONPLAN',
        value: stripeSub.items.data.find(
          (item) => item.plan.id === 'monthlyprotectionplan',
        ).id,
        userId: user.id,
      } as UserIntegration);
    }
  } else {
    stripeSub = await stripe.subscriptions.create({
      customer: stripeCustomer.value,
      items,
    });

    integrations = [
      {
        type: 'STRIPE_MONTHLYUNLIMITEDTIER',
        value: stripeSub.items.data.find((item) => item.plan.id === plan).id,
        userId: user.id,
      } as UserIntegration,
      {
        type: 'STRIPE_MONTHLYPLAN',
        value: stripeSub.id,
        userId: user.id,
      } as UserIntegration,
    ];

    if (stripeMonthlyProtectionPlan || cart.protectionPlan) {
      integrations.push({
        type: 'STRIPE_MONTHLYPROTECTIONPLAN',
        value: stripeSub.items.data.find(
          (item) => item.plan.id === 'monthlyprotectionplan',
        ).id,
        userId: user.id,
      } as UserIntegration);
    }
  }

  user.planId = plan;
  user.points = total > (user.points || 0) ? total : user.points;

  await user.save();

  await UserIntegration.bulkCreate(integrations, {
    updateOnDuplicate: ['id'],
  });

  return stripeSub;
}
