import { InputType, Field, ID, Int } from 'type-graphql';

@InputType()
export class CartItemUpdateInput {
  @Field((type) => ID)
  public id!: string;

  @Field((type) => Int, { nullable: true })
  public quantity?: number;
}
