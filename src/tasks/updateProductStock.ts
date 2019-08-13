import { Op } from 'sequelize';
import uuid from 'uuid/v4';

import { Product } from '../models/Product';
import { Inventory } from '../models/Inventory';
import { InventoryStatus } from '../enums/inventoryStatus';
import { pubSub } from '../redis';

export async function updateProductStock(req, res) {
  const { productId } = req.body;

  if (productId && req.header('X-AppEngine-TaskName')) {
    const stock = await Inventory.count({
      where: {
        productId,
        status: { [Op.contains]: InventoryStatus.INWAREHOUSE },
      },
    });

    Product.update(
      {
        stock,
      },
      {
        where: {
          productId,
        },
      },
    );

    await pubSub.publish('ADDRESS_UPDATED', {
      id: uuid(),
      message: {
        productId,
        stock,
      },
    });

    return res.send(`Updated product stock: ${productId}`).end();
  }

  return res
    .status(500)
    .send('Not authorized')
    .end();
}
