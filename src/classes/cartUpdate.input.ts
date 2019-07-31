import { InputType, Field, ID, Int } from 'type-graphql';

@InputType()
export class CartUpdateInput {
  @Field({ nullable: true })
  public planId?: string;

  @Field({ nullable: true })
  public protectionPlan?: boolean;

  @Field({ nullable: true })
  public service?: string;
}
