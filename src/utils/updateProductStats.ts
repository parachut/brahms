import sequelize from 'sequelize';

import { Product } from '../models/Product';
import { Inventory } from '../models/Inventory';
import { CartItem } from '../models/CartItem';
import { Queue } from '../models/Queue';
import { InventoryStatus } from '../enums/inventoryStatus';

export const updateProductStats = async (productId: string) => {
  const product = await Product.findByPk(productId, {
    attributes: ['id', 'popularity', 'demand'],
  });

  const [minPopularity] = (await Product.findAll({
    attributes: [[sequelize.fn('min', sequelize.col('popularity')), 'value']],
    raw: true,
  })) as any;

  const [maxPopularity] = (await Product.findAll({
    attributes: [[sequelize.fn('max', sequelize.col('popularity')), 'value']],
    raw: true,
  })) as any;

  const [CartItems, Queues, total, inStock] = await Promise.all([
    CartItem.count({
      where: {
        productId: product.id,
      },
    }),
    Queue.count({
      where: {
        productId: product.id,
      },
    }),
    Inventory.count({
      where: {
        productId: product.id,
      },
    }),
    Inventory.count({
      where: {
        productId: product.id,
        status: InventoryStatus.INWAREHOUSE,
      },
    }),
  ]);

  const popularity = (product.popularity + Queues + CartItems) / 2;

  const popularityPercentage =
    (popularity - minPopularity.value) /
    (maxPopularity.value - minPopularity.value);
  const outStockPercentage = total
    ? (total - inStock) / total
    : popularityPercentage;
  product.demand = Math.round(
    ((popularityPercentage * 2 + outStockPercentage) / 3) * 100,
  );
  product.popularity = Math.round(popularity - minPopularity.value);

  console.log(product.id, product.popularity, product.demand);

  await product.save();
  return product;
};
