import { WebClient } from '@slack/client';
import numeral from 'numeral';
import Stripe from 'stripe';

import { Cart } from '../models/Cart';
import { CartItem } from '../models/CartItem';
import { createTask } from '../utils/createTask';
import { UserIntegration } from '../models/UserIntegration';

if (!process.env.STRIPE) {
  throw new Error('Missing environment variable STRIPE');
}

if (!process.env.SLACK_TOKEN) {
  throw new Error('Missing environment variable SLACK_TOKEN');
}

const stripe = new Stripe(process.env.STRIPE);
const slack = new WebClient(process.env.SLACK_TOKEN);

export async function checkout(req, res) {
  const { cartId } = req.body;
  let integrations: UserIntegration[] = [];

  if (cartId && req.header('X-AppEngine-TaskName')) {
    const cart = await Cart.findByPk(cartId, {
      include: [
        {
          association: 'user',
          include: [
            {
              association: 'currentInventory',
              include: ['product'],
            },
            'integrations',
          ],
        },
        'items',
      ],
    });

    if (!cart) {
      return res
        .status(500)
        .send('Failed')
        .end();
    }

    const total = [...cart.items, ...cart.user.currentInventory].reduce(
      (r, i) => r + i.product.points * (i instanceof CartItem ? i.quantity : 1),
      0,
    );

    const stripeCustomer = cart.user.integrations.find(
      (int) => int.type === 'STRIPE',
    );

    const stripeMonthlyPlan = cart.user.integrations.find(
      (int) => int.type === 'STRIPE_MONTHLYPLAN',
    );

    const stripeUnlimitedTier = cart.user.integrations.find(
      (int) => int.type === 'STRIPE_MONTHLYUNLIMITEDTIER',
    );

    const stripeMonthlyProtectionPlan = cart.user.integrations.find(
      (int) => int.type === 'STRIPE_MONTHLYPROTECTIONPLAN',
    );

    const items: any[] = [
      {
        plan: cart.planId,
        quantity: total > (cart.user.points || 0) ? total : cart.user.points,
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

    if (cart.user.planId) {
      stripeSub = await stripe.subscriptions.update(stripeMonthlyPlan.value, {
        items,
      });

      if (!stripeMonthlyProtectionPlan && cart.protectionPlan) {
        integrations.push({
          type: 'STRIPE_MONTHLYPROTECTIONPLAN',
          value: stripeSub.items.data.find(
            (item) => item.plan.id === 'monthlyprotectionplan',
          ).id,
          userId: cart.user.id,
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
          value: stripeSub.items.data.find(
            (item) => item.plan.id === cart.planId,
          ).id,
          userId: cart.user.id,
        } as UserIntegration,
        {
          type: 'STRIPE_MONTHLYPLAN',
          value: stripeSub.id,
          userId: cart.user.id,
        } as UserIntegration,
      ];

      if (stripeMonthlyProtectionPlan || cart.protectionPlan) {
        integrations.push({
          type: 'STRIPE_MONTHLYPROTECTIONPLAN',
          value: stripeSub.items.data.find(
            (item) => item.plan.id === 'monthlyprotectionplan',
          ).id,
          userId: cart.user.id,
        } as UserIntegration);
      }
    }

    cart.user.planId = cart.planId;
    cart.user.points =
      total > (cart.user.points || 0) ? total : cart.user.points;

    await cart.user.save();

    await UserIntegration.bulkCreate(integrations, {
      updateOnDuplicate: ['id'],
    });

    if (cart.service !== 'Ground') {
      await stripe.invoiceItems.create({
        amount: 2500,
        currency: 'usd',
        customer: cart.user.stripeId,
        description: 'Expedited Shipping',
      });

      try {
        let invoice = await stripe.invoices.create({
          customer: cart.user.stripeId,
          auto_advance: true,
          billing: 'charge_automatically',
        });

        invoice = await stripe.invoices.pay(invoice.id);

        if (typeof invoice.charge !== 'string') {
          cart.chargeId = invoice.charge.id;
        } else {
          cart.chargeId = invoice.charge;
        }
      } catch (e) {
        throw e;
      }
    }

    await cart.save();

    cart.items.forEach((item) =>
      createTask('update-product-stock', {
        productId: item.productId,
      }),
    );

    if (process.env.STAGE === 'production') {
      await slack.chat.postMessage({
        channel: 'CGX5HELCT',
        text: '',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text:
                '*New order for:* ' +
                cart.user.name +
                '\n<https://team.parachut.co/ops/order/' +
                cart.id +
                '|' +
                cart.id +
                '>',
            },
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: '*Completed:*\n' + new Date().toLocaleString(),
              },
              {
                type: 'mrkdwn',
                text:
                  '*Total Points:*\n' +
                  numeral(cart.items.reduce((r, i) => r + i.points, 0)).format(
                    '0,0',
                  ),
              },

              {
                type: 'mrkdwn',
                text:
                  '*Protection Plan:*\n' + (cart.protectionPlan ? 'YES' : 'NO'),
              },
              {
                type: 'mrkdwn',
                text: '*Service:*\n' + cart.service,
              },
              {
                type: 'mrkdwn',
                text: '*Plan:*\n' + cart.planId || cart.user.planId,
              },
            ],
          },
        ],
      });
    }

    return res.send(`Cart stripe collected: ${cart.id}`).end();
  }

  return res
    .status(500)
    .send('Not authorized')
    .end();
}
