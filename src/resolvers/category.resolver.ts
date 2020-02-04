import { FieldResolver, Resolver, Root } from 'type-graphql';

import { Category } from '../models/Category';

@Resolver(Category)
export default class CategoryResolver {
  @FieldResolver((type) => Category)
  async parent(@Root() category: Category): Promise<Category> {
    return category.$get<Category>('parent') as Promise<Category>;
  }
}
