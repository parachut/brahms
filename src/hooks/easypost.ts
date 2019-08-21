import Geocodio from 'geocodio';
import pick from 'lodash/pick';
import util from 'util';

import { Inventory } from '../models/Inventory';
import { Cart } from '../models/Cart';
import { Shipment } from '../models/Shipment';
import { ShipmentEvent } from '../models/ShipmentEvent';
import { User } from '../models/User';
import { ShipmentStatus } from '../enums/shipmentStatus';
import { ShipmentType } from '../enums/shipmentType';
import { ShipmentDirection } from '../enums/shipmentDirection';
import { InventoryStatus } from '../enums/inventoryStatus';
import { createQueue } from '../redis';

const communicationQueue = createQueue('communication-queue');

const geocodio = new Geocodio({
  api_key: process.env.GEOCODIO,
});

const geocodioPromise = util.promisify(geocodio.get).bind(geocodio);

export async function easypost(req, res) {
  const { result } = req.body;

  if (result && result.description === 'tracker.updated') {
    const shipment = await Shipment.findOne({
      where: { easyPostId: result.shipment_id },
      include: ['user'],
    });

    if (!shipment) {
      return res.send('OK');
    }

    const carrierRecieved = result.tracking_details.find(
      (x: any) => x.status === 'in_transit',
    );
    const carrierDelivered = result.tracking_details.find(
      (x: any) => x.status === 'delivered',
    );

    if (carrierRecieved) {
      shipment.carrierReceivedAt = new Date(carrierRecieved.datetime);
    }

    if (carrierDelivered) {
      shipment.carrierDeliveredAt = new Date(carrierDelivered.datetime);
    }

    shipment.status = <ShipmentStatus>(
      ShipmentStatus[result.status.toUpperCase()]
    );

    shipment.signedBy = result.signed_by;
    shipment.estDeliveryDate = new Date(result.est_delivery_date);
    shipment.weight = result.weight;

    for (const detail of result.tracking_details) {
      const exists = await ShipmentEvent.findOne({
        where: { shipmentId: shipment.id, datetime: detail.datetime },
      });

      if (!exists) {
        const response = await geocodioPromise('geocode', {
          q: `${detail.tracking_location.city}, ${detail.tracking_location.state}`,
        });

        let { results } = JSON.parse(response);
        let [result] = results;

        await ShipmentEvent.create({
          ...pick(detail, ['message', 'source']),
          datetime: new Date(detail.datetime),
          status: <ShipmentStatus>ShipmentStatus[detail.status.toUpperCase()],
          cordinates: {
            type: 'Point',
            coordinates: [result.location.lat, result.location.lng],
          },
        });
      }
    }

    await shipment.save();

    await User.update(
      {
        billingHour: new Date().getHours(),
      },
      {
        where: {
          id: shipment.userId,
        },
      },
    );

    if (shipment.type === ShipmentType.ACCESS) {
      let update = {
        status: null,
      };

      if (shipment.direction === ShipmentDirection.INBOUND) {
        if (!shipment.carrierDeliveredAt && shipment.carrierReceivedAt) {
          update = {
            status: InventoryStatus.ENROUTEWAREHOUSE,
          };
        } else if (shipment.carrierDeliveredAt) {
          update = {
            status: InventoryStatus.INSPECTING,
          };
        }
        if (update.status) {
          Inventory.update(update, {
            where: {
              shipmentId: shipment.id,
            },
          });
        }
      } else {
        if (!shipment.carrierDeliveredAt && shipment.carrierReceivedAt) {
          update = {
            status: InventoryStatus.ENROUTEMEMBER,
          };
        } else if (shipment.carrierDeliveredAt) {
          update = {
            status: InventoryStatus.WITHMEMBER,
          };

          if (shipment.cartId) {
            communicationQueue.add('send-delivery-email', {
              shipmentId: shipment.id,
            });
          }
        }
        if (update.status) {
          Inventory.update(update, {
            where: {
              shipmentId: shipment.id,
            },
          });
        }
      }
    }

    return res.send(`Shipment updated`).end();
  }

  return res
    .status(200)
    .send('Shipment not found')
    .end();
}