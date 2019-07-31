import { InputType, Field, ID, Int } from 'type-graphql';

@InputType()
export class ShipmentWhereUniqueInput {
  @Field((type) => ID)
  public id!: string;
}
