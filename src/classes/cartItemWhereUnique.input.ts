import { InputType, Field, ID, Int } from 'type-graphql';

@InputType()
export class CartItemWhereUniqueInput {
  @Field((type) => ID)
  public id!: string;
}
