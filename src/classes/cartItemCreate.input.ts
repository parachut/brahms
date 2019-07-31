import { InputType, Field, ID, Int } from 'type-graphql';

@InputType()
export class CartItemCreateInput {
  @Field((type) => ID)
  public productId!: string;

  @Field((type) => Int, { nullable: true })
  public quantity?: number;
}
