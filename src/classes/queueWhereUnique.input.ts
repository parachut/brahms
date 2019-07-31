import { InputType, Field, ID, Int } from 'type-graphql';

@InputType()
export class QueueWhereUniqueInput {
  @Field((type) => ID)
  public id!: string;
}
