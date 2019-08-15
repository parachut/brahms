import { Op } from 'sequelize';
import { Arg, Authorized, Ctx, Query, Resolver } from 'type-graphql';

import { CatalogSearchResult } from '../classes/catalogSearchResult';
import { UserRole } from '../enums/userRole';
import { Brand } from '../models/Brand';
import { Category } from '../models/Category';
import { Product } from '../models/Product';
import { IContext } from '../utils/context.interface';

@Resolver()
export default class SearchResolver {
  @Authorized([UserRole.MEMBER])
  @Query((returns) => [CatalogSearchResult])
  public async catalogSearch(
    @Arg('search', (type) => String)
    search: string,
    @Ctx() ctx: IContext,
  ) {
    if (ctx.user) {
      const categories = Category.findAll({
        where: { name: { [Op.iLike]: `%${search}%` } },
        limit: 10,
        attributes: ['name', 'slug'],
      });

      const brands = Brand.findAll({
        where: { name: { [Op.iLike]: `%${search}%` } },
        limit: 10,
        attributes: ['name', 'slug'],
      });
      const products = Product.findAll({
        where: { name: { [Op.iLike]: `%${search}%` } },
        limit: 10,
        attributes: ['name', 'slug'],
      });

      let results: any = await Promise.all([categories, brands, products]);
      const indexes = ['category', 'brand', 'product'];
      results = results.map((result: any, i: number) => {
        return result.map((item: any) => ({
          collection: indexes[i],
          name: item.name,
          slug: item.slug,
        }));
      });

      return Array.prototype.concat.apply([], results);
    }

    throw new Error('Unauthorised.');
  }

  @Authorized([UserRole.MEMBER])
  @Query((returns) => [Product])
  public async productSearch(
    @Arg('search', (type) => String)
    search: string,
    @Ctx() ctx: IContext,
  ) {
    if (ctx.user) {
      const products = await Product.findAll({
        where: { name: { [Op.iLike]: `%${search}%` } },
        limit: 25,
      });

      return products;
    }

    throw new Error('Unauthorised.');
  }
}
