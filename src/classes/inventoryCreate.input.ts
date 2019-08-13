import { InputType, Field, ID } from 'type-graphql';

import { InventoryCondition } from '../enums/inventoryCondition';

@InputType()
export class InventoryCreateInput {
  @Field((type) => ID)
  public productId!: string;

  @Field((type) => InventoryCondition)
  public condition!: InventoryCondition;

  @Field((type) => [String], { nullable: true })
  public missingEssentials?: string[];
}
