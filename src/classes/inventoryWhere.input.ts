import { InputType, Field, ID } from 'type-graphql';

import { InventoryStatus } from '../enums/inventoryStatus';

@InputType()
export class InventoryWhereInput {
  @Field((type) => [InventoryStatus], { nullable: true })
  public status?: [InventoryStatus];

  @Field((type) => ID, { nullable: true })
  public id?: string;
}
