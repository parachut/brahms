import { Op } from "sequelize";
import uuid from "uuid/v4";

import { Product } from "@common/models/Product";
import { Inventory } from "@common/models/Inventory";
import { InventoryStatus } from "@common/enums/inventoryStatus";
import { pubSub } from "@common/redis";

async function updateProductStock(job) {
  const { productId } = job.data;

  if (productId) {
    const stock = await Inventory.count({
      where: {
        productId,
        status: { [Op.contains]: InventoryStatus.INWAREHOUSE }
      }
    });

    Product.update(
      {
        stock
      },
      {
        where: {
          productId
        }
      }
    );

    await pubSub.publish("ADDRESS_UPDATED", {
      id: uuid(),
      message: {
        productId,
        stock
      }
    });

    return `Updated product stock: ${productId}`;
  }
}

export default updateProductStock;
