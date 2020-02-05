require('dotenv').config();

import { sequelize } from './db';

import { Category } from './models/Category';
import { Product } from './models/Product';

const { Client } = require('@elastic/elasticsearch');

const migrator = async () => {
  await sequelize;

  const categories = await Category.findAll({});

  function findBreadCrumbs(cat: Category): Category[] {
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

  console.log('start');

  const elasti = new Client({
    node:
      'https://elastic:acNbgQRsl0OUznitAboYVss6@cb0a068fb8d64b3294ede898764e8f96.us-central1.gcp.cloud.es.io:9243',
  });

  const products = await Product.findAll({
    include: ['brand', 'category', 'inventory'],
  });

  for (const product of products) {
    const stock = product.inventory.filter((i) => i.status === 'INWAREHOUSE')
      .length;
    if (stock !== product.stock) {
      await Product.update(
        {
          stock,
        },
        {
          where: {
            id: product.id,
          },
        },
      );
    }
  }

  await elasti.indices.delete({ index: 'products' });

  await elasti.indices.create(
    {
      index: 'products',
      body: {
        mappings: {
          properties: {
            id: { type: 'text' },
            name: { type: 'search_as_you_type' },
            aliases: { type: 'search_as_you_type' },
            brand: {
              type: 'object',
              properties: {
                name: { type: 'text' },
                id: { type: 'text' },
                slug: { type: 'text' },
              },
            },
            category: {
              type: 'object',
              properties: {
                name: { type: 'text' },
                id: { type: 'text' },
                slug: { type: 'text' },
              },
            },
            slug: { type: 'text' },
            popularity: { type: 'integer' },
            images: { type: 'text' },
            camera: { type: 'boolean' },
            lens: { type: 'boolean' },
            demand: { type: 'integer' },
            points: { type: 'integer' },
            stock: { type: 'integer' },
            createdAt: { type: 'date' },
            lastInventoryCreated: { type: 'date' },
          },
        },
      },
    },
    { ignore: [400] },
  );

  const dataset: any = products.map((product) => {
    let cats = null;
    if (product.category) {
      cats = findBreadCrumbs(product.category);
    }

    return {
      id: product.id,
      name: product.name,
      camera: cats
        ? !!cats.find((category) => category.name.search('Cameras') !== -1)
        : false,
      lens: cats
        ? !!cats.find((category) => category.name.search('Lenses') !== -1)
        : false,
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
  });

  const body = dataset.flatMap((doc) => [
    { index: { _index: 'products' } },
    doc,
  ]);

  const { body: bulkResponse } = await elasti.bulk({ refresh: true, body });

  if (bulkResponse.errors) {
    const erroredDocuments = [];
    // The items array has the same order of the dataset we just indexed.
    // The presence of the `error` key indicates that the operation
    // that we did for the document has failed.
    bulkResponse.items.forEach((action, i) => {
      const operation = Object.keys(action)[0];
      if (action[operation].error) {
        erroredDocuments.push({
          // If the status is 429 it means that you can retry the document,
          // otherwise it's very likely a mapping error, and you should
          // fix the document before to try it again.
          status: action[operation].status,
          error: action[operation].error,
          operation: body[i * 2],
          document: body[i * 2 + 1],
        });
      }
    });
    console.log(erroredDocuments);
  }

  const { body: count } = await elasti.count({ index: 'products' });
  console.log(count);
};

migrator();
