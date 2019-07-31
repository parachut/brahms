import { InputType, Field, ID, Int } from 'type-graphql';

@InputType()
export class ShipmentCreateInput {
  @Field((type) => [ID])
  public inventoryIds!: string[];
}
