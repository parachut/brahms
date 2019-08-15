import { InputType, Field, ID, Int } from 'type-graphql';

import { ShipmentType } from '../enums/shipmentType';

@InputType()
export class ShipmentCreateInput {
  @Field((type) => [ID])
  public inventoryIds!: string[];

  @Field((type) => ShipmentType)
  public type!: ShipmentType;
}
