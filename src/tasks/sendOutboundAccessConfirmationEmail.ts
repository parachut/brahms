import { sendEmail } from '../utils/sendEmail';
import { Cart } from '../models/Cart';
import { CartItem } from '../models/CartItem';
import { plans } from '../decorators/plans';

async function sendOutboundAccessConfirmationEmail(job) {
  const { cartId } = job.data;

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
      {
        association: 'items',
        include: ['product'],
      },
    ],
  });

  const total = cart.user.currentInventory.reduce(
    (r, i) => r + i.product.points,
    0,
  );

  await sendEmail({
    to: cart.user.email,
    from: 'support@parachut.co',
    id: 12931487,
    data: {
      purchase_date: new Date().toDateString(),
      name: cart.user.name,
      chutItems: cart.items.map((item) => ({
        image: item.product.images.length
          ? `https://parachut.imgix.net/${item.product.images[0]}`
          : '',
        name: item.product.name,
        points: item.product.points,
      })),
      planId: cart.planId,
      monthly: plans[cart.planId],
      pointsOver: Math.max(0, total - Number(cart.planId)),
      overage: Math.max(0, total - Number(cart.planId)) * 0.1,
      protectionPlan: cart.protectionPlan,
      totalMonthly: total + Math.max(0, total - Number(cart.planId)) * 0.1,
      availablePoints: cart.user.points - total,
      cartPoints: cart.items.reduce((r, i) => r + i.points, 0),
    },
  });

  return cart;
}

export default sendOutboundAccessConfirmationEmail;
