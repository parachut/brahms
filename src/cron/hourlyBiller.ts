import pMap from 'p-map';
import { Op } from 'sequelize';
import Stripe from 'stripe';

import { InventoryStatus } from '../enums/inventoryStatus';
import { InvoiceStatus } from '../enums/invoiceStatus';
import { Cart } from '../models/Cart';
import { Inventory } from '../models/Inventory';
import { Invoice } from '../models/Invoice';
import { InvoiceItem } from '../models/InvoiceItem';
import { User } from '../models/User';
import {
  calcDailyCommission,
  calcDailyRate,
  calcProtectionDailyRate,
} from '../utils/calc';

const stripe = new Stripe(process.env.STRIPE);

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

  const twelveHoursAgo = new Date(
    new Date().getTime() - 1 * 12 * 60 * 60 * 1000,
  );

  for (const user of users) {
    const hasPriorCharge = await Invoice.count({
      where: {
        userId: user.id,
        createdAt: { [Op.gte]: twelveHoursAgo },
      },
    });

    const hasMonthlyPlan = user.integrations.find(
      (int) => int.type === 'STRIPE_MONTHLYPLAN',
    );

    const hasMonthlyProtectionPlan = user.integrations.find(
      (int) => int.type === 'STRIPE_MONTHLYPROTECTIONPLAN',
    );

    if (!hasPriorCharge) {
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

      const invoice = await Invoice.create({
        total,
        userId: user.id,
        status: status ? InvoiceStatus.COLLECTED : InvoiceStatus.FAILED,
        subscription: !!hasMonthlyPlan,
        stripeId: stripeInvoice ? stripeInvoice.id : null,
        collectedAt: status ? new Date() : null,
      });

      await pMap(invoiceItems, (item) =>
        InvoiceItem.create({ ...item, invoiceId: invoice.id }),
      );
    }
  }

  res.send(users);
}
