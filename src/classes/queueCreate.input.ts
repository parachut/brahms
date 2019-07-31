import { InputType, Field, ID, Int } from 'type-graphql';

@InputType()
export class QueueCreateInput {
  @Field((type) => ID)
  public productId!: string;
}
