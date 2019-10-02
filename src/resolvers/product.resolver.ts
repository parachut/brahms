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
  Resolver,
  Root,
} from 'type-graphql';
import { Op } from 'sequelize';
import camelCase from 'lodash/camelCase';

import { connectionTypes } from '../classes/connection';
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
import { getParentCategories } from '../utils/getParentCategories';

const { Connection } = connectionTypes('Product', Product);

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

  @Authorized([UserRole.MEMBER])
  @Query((returns) => Connection)
  public async products(
    @Arg('first', (type) => Int, { nullable: true }) first: number,
    @Arg('after', (type) => String, { nullable: true }) after: string,
    @Arg('last', (type) => Int, { nullable: true }) last: number,
    @Arg('before', (type) => String, { nullable: true }) before: string,
    @Arg('filter', (type) => ProductFilterInput, { nullable: true })
    filter: ProductFilterInput,
    @Arg('sort', (type) => ProductSort, { nullable: true }) sort: ProductSort,
    @Ctx() ctx: IContext,
    @Info() info: any,
  ) {
    if (ctx.user) {
      let orderBy: any = [['stock', 'DESC']];

      if (sort) {
        const splitSort = sort.split('_');
        const direction = splitSort.pop().toLowerCase();
        const column = camelCase(splitSort.join('_'));

        orderBy = [[column, direction]];
      }

      let searchIds: any = [];

      if (filter && filter.search) {
        searchIds = await ctx.sequelize.query(
          `
            SELECT id
            FROM products
            WHERE _search @@ plainto_tsquery('english', :query);
          `,
          {
            model: Product,
            replacements: {
              query:
                filter.search
                  .trim()
                  .split(' ')
                  .join('&') + ':*',
            },
          },
        );
      }

      const connection = createConnectionResolver({
        target: Product,
        where: (key, value) => {
          if (value) {
            if (key === 'where') {
              const where: any = {};
              if (value.inStock) {
                where.stock = { [Op.gt]: 0 };
              }

              if (value.search) {
                where.id = {
                  [Op.in]: map(searchIds, 'id'),
                };
              }

              return where;
            }
          }
        },
      });

      const result = await connection.resolveConnection(
        null,
        {
          first,
          after,
          last,
          before,
          where: filter,
          orderBy,
        },
        ctx,
        info,
      );

      return result;
    }

    throw new Error('Unauthorised.');
  }

  @FieldResolver((type) => Brand)
  async brand(@Root() product: Product): Promise<Brand> {
    return ((await product.$get<Brand>('brand')) as Brand)!;
  }

  @FieldResolver((type) => Category, { nullable: true })
  async category(@Root() product: Product): Promise<Category> {
    return (await product.$get<Category>('category')) as Category;
  }

  @FieldResolver()
  dailyCommission(@Root() product: Product): number {
    return calcDailyCommission(product.points);
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

  @FieldResolver((type) => [Category])
  async breadcrumbs(@Root() product: Product): Promise<Category[]> {
    const productWithCategory = await Product.findByPk(product.id);
    if (productWithCategory && productWithCategory.category) {
      const category = await Category.findByPk(productWithCategory.categoryId);

      return category ? getParentCategories(category) : [];
    } else {
      return [];
    }
  }

  @FieldResolver((type) => Int)
  async total(@Root() product: Product): Promise<number> {
    return product.$count('inventory');
  }
}
