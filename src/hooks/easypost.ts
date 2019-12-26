import { Op } from 'sequelize';

import { Inventory } from '../models/Inventory';
import { Shipment } from '../models/Shipment';
import { User } from '../models/User';
import { ShipmentStatus } from '../enums/shipmentStatus';
import { ShipmentType } from '../enums/shipmentType';
import { ShipmentDirection } from '../enums/shipmentDirection';
import { InventoryStatus } from '../enums/inventoryStatus';

export async function easypost(req, res) {
  if (!req.body) {
    return res.send('OK');
  }

  const { result, description } = req.body;

  if (!result || !description) {
    return res.send('OK');
  }

  if (result && description === 'tracker.updated') {
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
      ShipmentStatus[result.status.toUpperCase().replace(/_/g, '')]
    );

    shipment.signedBy = result.signed_by;
    shipment.estDeliveryDate = new Date(result.est_delivery_date);
    shipment.weight = result.weight;

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

      const shipmentInventory = (await shipment.$get<Inventory>(
        'inventory',
      )) as Inventory[];

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
              id: { [Op.in]: shipmentInventory.map((s) => s.id) },
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
        }
        if (update.status) {
          Inventory.update(update, {
            where: {
              id: { [Op.in]: shipmentInventory.map((s) => s.id) },
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
