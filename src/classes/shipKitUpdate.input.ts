import { InputType, Field, ID, Int } from 'type-graphql';

@InputType()
export class ShipKitUpdateInput {
  @Field({ nullable: true })
  public addressId?: string;

  @Field({ nullable: true })
  public airbox?: boolean;
}
