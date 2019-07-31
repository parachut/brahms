import { FieldResolver, Resolver, Root } from 'type-graphql';

import { Inventory } from '../models/Inventory';
import { User } from '../models/User';

@Resolver(User)
export default class UserResolver {
  @FieldResolver((type) => [Inventory])
  async currentInventory(@Root() user: User): Promise<Inventory[]> {
    return ((await user.$get<Inventory>('currentInventory')) as Inventory[])!;
  }

  @FieldResolver((type) => [Inventory])
  async inventory(@Root() user: User): Promise<Inventory[]> {
    return ((await user.$get<Inventory>('inventory')) as Inventory[])!;
  }
}
