import { Op } from 'sequelize';
import uuid from 'uuid/v4';

import { InventoryStatus } from '../enums/inventoryStatus';
import { Inventory } from '../models/Inventory';
import { Product } from '../models/Product';
import { pubSub } from '../redis';

export async function updateProductStock(productId: string) {
  if (productId) {
    const stock = await Inventory.count({
      where: {
        productId,
        status: { [Op.contains]: InventoryStatus.INWAREHOUSE },
      },
    });

    await Product.update(
      {
        stock,
      },
      {
        where: {
          id: productId,
        },
      },
    );

    await pubSub.publish('PRODUCT_UPDATED', {
      id: uuid(),
      message: {
        productId,
        stock,
      },
    });
  }
}
