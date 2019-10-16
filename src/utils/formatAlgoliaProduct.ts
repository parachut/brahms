import pick from 'lodash/pick';

import { Category } from '../models/Category';
import { Product } from '../models/Product';

export const formatAlgoliaProduct = async (instance) => {
  const product = instance.where
    ? await Product.findAll({
        where: instance.where,
        include: ['brand', 'category'],
      })
    : await Product.findByPk(instance.id, { include: ['brand', 'category'] });

  const categories = await Category.findAll({});

  function findBreadCrumbs(cat: Category) {
    const _categories = [cat];

    const getParent = async (child: Category) => {
      if (child.parentId) {
        const parent = categories.find((cate) => cate.id === child.parentId);

        if (parent) {
          _categories.push(parent);

          if (parent.parentId) {
            getParent(parent);
          }
        }
      }
    };

    getParent(cat);

    return _categories;
  }

  function mapProduct(product) {
    return {
      objectID: product.id,
      ...pick(product, [
        'name',
        'popularity',
        'demand',
        'description',
        'features',
        'lastInventoryCreated',
        'mfr',
        'images',
        'stock',
        'slug',
        'points',
      ]),
      brand: product.brand ? product.brand.name : null,
      categories: product.category
        ? {
          lvl0: product.category.name
        }
        : {},
    };
  }

  if (Array.isArray(product)) {
    return product.map(mapProduct);
  } else {
    return [mapProduct(product)];
  }
};
