import { WebClient } from '@slack/client';
import numeral from 'numeral';
import pMap from 'p-map';
import { Op } from 'sequelize';
import Stripe from 'stripe';

import { InventoryStatus } from '../enums/inventoryStatus';
import { Cart } from '../models/Cart';
import { Inventory } from '../models/Inventory';
import { User } from '../models/User';
import {
  calcDailyCommission,
  calcDailyRate,
  calcProtectionDailyRate,
} from '../utils/calc';

const stripe = new Stripe(process.env.STRIPE);
const slack = new WebClient(process.env.SLACK_TOKEN);

export async function hourlyBiller(req, res) {
  if (
    process.env.STAGE === 'production' &&
    req.get('X-Appengine-Cron') !== 'true'
  ) {
    return res.status(401).end();
  }

  let totalBilled: number = 0;
  let totalCollections: number = 0;
  let totalMembers: number = 0;
  let totalItems: number = 0;

  const billingHour = new Date().getHours();

  const users = await User.findAll({
    where: {
      billingHour,
      '$currentInventory.id$': { [Op.ne]: null },
    },
    attributes: ['id', 'billingHour', 'stripeId'],
    include: [
      {
        association: 'currentInventory',
        attributes: ['id'],
      },
      {
        association: 'integrations',
        attributes: ['type', 'value'],
      },
    ],
  });

  for (const user of users) {
    const hasMonthlyPlan = user.integrations.find(
      (int) => int.type === 'STRIPE_MONTHLYPLAN',
    );

    const hasMonthlyProtectionPlan = user.integrations.find(
      (int) => int.type === 'STRIPE_MONTHLYPROTECTIONPLAN',
    );

    const currentInventory = await Inventory.findAll({
      where: {
        memberId: user.id,
        status: {
          [Op.in]: [InventoryStatus.WITHMEMBER, InventoryStatus.RETURNING],
        },
      },
      include: [
        {
          association: 'product',
          attributes: ['id', 'points', 'name'],
        },
      ],
    });

    const invoiceItems = [];

    for (const item of currentInventory) {
      let protectionPlan = !!hasMonthlyProtectionPlan;

      if (!protectionPlan && !hasMonthlyPlan) {
        const cart = await Cart.findOne({
          where: {
            userId: user.id,
            '$inventory.id$': item.id,
          },
          include: [
            {
              association: 'inventory',
              attributes: ['id'],
            },
          ],
        });
        protectionPlan = cart ? cart.protectionPlan : false;
      }

      const { points } = item.product;

      const dailyRate = calcDailyRate(points);

      const protectionPlanRate = protectionPlan
        ? calcProtectionDailyRate(points)
        : 0;

      invoiceItems.push({
        dailyRate: dailyRate + protectionPlanRate,
        commission: calcDailyCommission(points),
        points: item.product.points,
        protectionPlan: protectionPlan,
        inventoryId: item.id,
      });
    }

    totalItems = totalItems + invoiceItems.length;
    const total = invoiceItems.reduce((r, i) => r + i.points, 0);

    let status = true;
    let stripeInvoice;

    try {
      const mapper = async (item) => {
        return stripe.invoiceItems.create({
          customer: user.stripeId,
          amount: item.dailyRate * 100,
          currency: 'usd',
          description: currentInventory.find(
            (itemr) => itemr.id === item.inventoryId,
          ).product.name,
          metadata: {
            id: item.inventoryId,
          },
        });
      };

      if (!hasMonthlyPlan) {
        await pMap(invoiceItems, mapper, { concurrency: 5 });
        stripeInvoice = await stripe.invoices.create({
          customer: user.stripeId,
          auto_advance: true,
          billing: 'charge_automatically',
        });

        if (stripeInvoice.paid) {
          totalBilled = totalBilled + total;
        } else {
          totalCollections = totalCollections + total;
        }
      }
    } catch (e) {
      totalCollections = totalCollections + total;
      status = false;
    }
  }

  await slack.chat.postMessage({
    channel: 'C3NG3KU4E',
    text: '',
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Invoice hourly report:* ' + new Date().toLocaleString(),
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: '*Successful:*\n' + numeral(totalBilled).format('$0,0[.]00'),
          },
          {
            type: 'mrkdwn',
            text: '*Failed:*\n' + numeral(totalCollections).format('($0,0)'),
          },
          {
            type: 'mrkdwn',
            text: '*Members:*\n' + numeral(totalMembers).format('0,0'),
          },
          {
            type: 'mrkdwn',
            text: '*Items:*\n' + numeral(totalItems).format('0,0'),
          },
        ],
      },
    ],
  });

  res.send(users);
}
