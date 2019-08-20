import { Cart } from '../models/Cart';
import { Shipment } from '../models/Shipment';
import { sendEmail } from '../utils/sendEmail';

async function sendOutboundAccessShipmentEmail(job) {
  const { shipmentId } = job.data;

  const shipment = await Shipment.findByPk(shipmentId);

  const cart = await Cart.findByPk(shipment.cartId, {
    include: [
      {
        association: 'items',
        include: ['product'],
      },
      'user',
    ],
  });

  return sendEmail({
    to: cart.user.email,
    id: 12950070,
    data: {
      purchase_date: new Date(cart.completedAt).toLocaleDateString(),
      name: cart.user.name,
      chutItems: cart.items.map((item) => ({
        image: item.product.images.length
          ? `https://parachut.imgix.net/${item.product.images[0]}`
          : '',
        name: item.product.name,
      })),
      address: shipment.address.formattedAddress,
      estDeliveryDate: new Date(shipment.estDeliveryDate).toLocaleDateString(),
      publicUrl: shipment.publicUrl,
      trackingCode: shipment.trackingCode,
    },
  });
}

export default sendOutboundAccessShipmentEmail;
