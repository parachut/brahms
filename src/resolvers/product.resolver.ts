import { createConnectionResolver } from 'graphql-sequelize';
import map from 'lodash/map';
import {
  Arg,
  Authorized,
  Ctx,
  FieldResolver,
  Info,
  Int,
  Query,
  ObjectType,
  Resolver,
  Root,
} from 'type-graphql';
import { Op } from 'sequelize';
import camelCase from 'lodash/camelCase';
import { Client } from '@elastic/elasticsearch';

import { PaginatedResponse } from '../classes/paginatedResponse';
import { ProductFilterInput } from '../classes/productFilter.input';
import { ProductSort } from '../enums/productSort';
import { UserRole } from '../enums/userRole';
import { Brand } from '../models/Brand';
import { Category } from '../models/Category';
import { Product } from '../models/Product';
import {
  calcDailyCommission,
  calcDailyRate,
  calcProtectionDailyRate,
} from '../utils/calc';
import { IContext } from '../utils/context.interface';

@ObjectType()
class ProductsResponse extends PaginatedResponse(Product) {}

const elasti = new Client({
  node:
    'https://elastic:acNbgQRsl0OUznitAboYVss6@cb0a068fb8d64b3294ede898764e8f96.us-central1.gcp.cloud.es.io:9243',
});

@Resolver(Product)
export default class ProductResolver {
  @Authorized([UserRole.MEMBER])
  @Query((returns) => Product)
  public async product(
    @Arg('slug', (type) => String) slug: string,
    @Ctx() ctx: IContext,
  ) {
    if (ctx.user) {
      return Product.findOne({
        where: { slug },
      });
    }

    throw new Error('Unauthorised.');
  }

  @Query((returns) => ProductsResponse)
  public async products(
    @Arg('from', (type) => Int, { nullable: true, defaultValue: 0 })
    from: number,
    @Arg('size', (type) => Int, { nullable: true, defaultValue: 10 })
    size: number,
    @Arg('filter', (type) => ProductFilterInput, { nullable: true })
    filter: ProductFilterInput,
    @Arg('sort', (type) => ProductSort, {
      nullable: true,
      defaultValue: ProductSort['ID_DESC'],
    })
    sort: ProductSort,
    @Ctx() ctx: IContext,
    @Info() info: any,
  ) {
    const lastIndex = sort.lastIndexOf('_');

    let sortBy: any = [
      {
        [camelCase(sort.substr(0, lastIndex))]: {
          order: camelCase(sort.substr(lastIndex)),
        },
      },
    ];

    const filtered = [];

    if (sort.startsWith('LAST_INVENTORY_CREATED')) {
      filtered.push({
        exists: {
          field: 'lastInventoryCreated',
        },
      });
    }

    if (sort.startsWith('POPULAR')) {
      sortBy.unshift({
        _script: {
          type: 'number',
          script: {
            lang: 'painless',
            source: 'doc.stock.value * params.factor + doc.popularity.value',
            params: {
              factor: 100,
            },
          },
          order: 'desc',
        },
      });

      sortBy.push('_score');
    }

    const filterDefault = {
      minPoints: 0,
      maxPoints: 100000,
      ...filter,
    };

    const must: any = [
      {
        range: {
          points: {
            gte: filterDefault.minPoints,
            lte: filterDefault.maxPoints,
          },
        },
      },
    ];

    if (filterDefault.inStock) {
      must.push({
        range: { stock: { gte: 1 } },
      });
    }

    if (filterDefault.search) {
      filtered.push({
        multi_match: {
          fields: [
            'name',
            'aliases',
            'name._2gram',
            'name._3gram',
            'aliases._2gram',
            'aliases._3gram',
          ],
          query: filterDefault.search.toLowerCase(),
          type: 'best_fields',
          tie_breaker: 0.3,
        },
      });

      if (sort === 'DEMAND_DESC') {
        sortBy = [
          {
            _script: {
              type: 'number',
              script: {
                lang: 'painless',
                source: '_score + (params.factor * doc.popularity.value)',
                params: {
                  factor: 0.01,
                },
              },
              order: 'desc',
            },
          },
        ];
      }
    }

    if (filterDefault.brand) {
      must.push({
        term: { brand: filterDefault.brand.toLowerCase() },
      });
    }

    const { body } = await elasti.search({
      index: 'products',
      body: {
        track_scores: true,
        from,
        size,
        sort: sortBy,
        query: {
          bool: {
            must: [...must, ...filtered],
          },
        },
      },
    });

    const items = await Product.findAll({
      where: { id: { [Op.in]: body.hits.hits.map((hit) => hit._source.id) } },
    });

    return {
      items: body.hits.hits.map((hit) =>
        items.find((i) => i.id === hit._source.id),
      ),
      total: body.hits.total.value,
      hasMore: body.hits.total.value < from + size,
      from,
      size,
    };
  }

  @FieldResolver((type) => Brand)
  async brand(@Root() product: Product): Promise<Brand> {
    return product.$get<Brand>('brand') as Promise<Brand>;
  }

  @FieldResolver((type) => Category, { nullable: true })
  async category(@Root() product: Product): Promise<Category> {
    return product.$get<Category>('category') as Promise<Category>;
  }

  @FieldResolver()
  dailyCommission(@Root() product: Product): number {
    return calcDailyCommission(product.points);
  }

  @FieldResolver()
  dailyCommissionLegacy(@Root() product: Product): number {
    return calcDailyCommission(product.points, true);
  }

  @FieldResolver((type) => Int)
  dailyRate(@Root() product: Product): number {
    return calcDailyRate(product.points);
  }

  @FieldResolver((type) => Int)
  dailyProtectionRate(@Root() product: Product): number {
    return calcProtectionDailyRate(product.points);
  }

  @FieldResolver()
  estimatedCommission(@Root() product: Product): number {
    return Math.round(25 * calcDailyCommission(product.points));
  }

  @FieldResolver()
  estimatedCommissionLegacy(@Root() product: Product): number {
    return Math.round(25 * calcDailyCommission(product.points, true));
  }

  @FieldResolver((type) => [Category])
  async breadcrumbs(@Root() product: Product): Promise<Category[]> {
    const [productWithCategory, categories] = await Promise.all([
      Product.findByPk(product.id, {
        include: ['category'],
        attributes: ['id', 'category_id'],
      }),
      Category.findAll({}),
    ]);

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

    if (productWithCategory && productWithCategory.category) {
      return findBreadCrumbs(productWithCategory.category);
    } else {
      return [];
    }
  }

  @FieldResolver((type) => Int)
  async total(@Root() product: Product): Promise<number> {
    return product.$count('inventory');
  }
}
