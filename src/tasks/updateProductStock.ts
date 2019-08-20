import { Op } from 'sequelize';
import uuid from 'uuid/v4';

import { Product } from '../models/Product';
import { Inventory } from '../models/Inventory';
import { InventoryStatus } from '../enums/inventoryStatus';
import { pubSub } from '../redis';

async function updateProductStock(job) {
  const { productId } = job.data || job;

  if (productId) {
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

    return productId;
  }
}

export default updateProductStock;
