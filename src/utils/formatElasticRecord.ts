import pick from 'lodash/pick';

import { Product } from '../models/Product';

export const formatElasticRecord = async (instance) => {
  const product = instance.where
    ? await Product.findAll({
        where: instance.where,
        include: ['brand', 'category'],
      })
    : await Product.findByPk(instance.id, { include: ['brand', 'category'] });

  function mapProduct(product) {
    return {
      id: product.id,
      name: product.name,
      category: product.category
        ? {
            name: product.category.name,
            id: product.category.id,
            slug: product.category.slug,
          }
        : null,
      brand: product.brand
        ? {
            name: product.brand.name,
            id: product.brand.id,
            slug: product.brand.slug,
          }
        : null,
      slug: product.slug,
      aliases: product.aliases
        ? product.aliases.split(',').map((a) => a.trim())
        : null,
      stock: product.inventory.filter((i) => i.status === 'INWAREHOUSE').length,
      points: product.points,
      images: product.images,
      popularity: product.popularity,
      demand: product.demand,
      lastInventoryCreated: product.lastInventoryCreated,
    };
  }

  if (Array.isArray(product)) {
    return product.map(mapProduct);
  } else {
    return [mapProduct(product)];
  }
};
