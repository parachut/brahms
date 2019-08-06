import { InputType, Field, ID, Int } from 'type-graphql';

@InputType()
export class CartItemUpdateInput {
  @Field((type) => Int, { nullable: true })
  public quantity?: number;
}
