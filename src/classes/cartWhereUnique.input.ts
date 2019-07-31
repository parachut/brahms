import { InputType, Field, ID, Int } from 'type-graphql';

@InputType()
export class CartWhereUniqueInput {
  @Field((type) => ID)
  public id!: string;
}
