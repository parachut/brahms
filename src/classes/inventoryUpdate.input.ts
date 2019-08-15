import { InputType, Field, ID } from 'type-graphql';

import { InventoryCondition } from '../enums/inventoryCondition';

@InputType()
export class InventoryUpdateInput {
  @Field((type) => ID, { nullable: true })
  public productId?: string;

  @Field((type) => InventoryCondition, { nullable: true })
  public condition?: InventoryCondition;

  @Field((type) => [String], { nullable: true })
  public missingEssentials?: string[];
}
