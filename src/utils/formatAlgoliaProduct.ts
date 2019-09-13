import pick from 'lodash/pick';

import { Category } from '../models/Category';

export const formatAlgoliaProduct = async (product) => {
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
      'stock',
      'slug',
      'points',
    ]),
    brand: product.brand.name,
    categories: product.category
      ? findBreadCrumbs(product.category)
          .reverse()
          .reduce((r, c, i) => {
            r[`lvl${i}`] = c.name;
            return r;
          }, {})
      : {},
  };
};
