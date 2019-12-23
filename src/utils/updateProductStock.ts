import uuid from 'uuid/v4'

import { InventoryStatus } from '../enums/inventoryStatus'
import { Inventory } from '../models/Inventory'
import { Product } from '../models/Product'

export async function updateProductStock (productId: string) {
  if (productId) {
    const stock = await Inventory.count({
      where: {
        productId,
        status: InventoryStatus.INWAREHOUSE,
      },
    })

    const product = await Product.findByPk(productId)

    if (product.stock !== stock) {
      await Product.update(
        {
          stock,
        },
        {
          where: {
            id: productId,
          },
        },
      )
    }
  }
}
