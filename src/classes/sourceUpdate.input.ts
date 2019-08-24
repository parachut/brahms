import { Field, InputType, ID } from 'type-graphql';

@InputType()
export class SourceUpdateInput {
  @Field()
  public token!: string;

  @Field()
  public firstName!: string;

  @Field()
  public lastName!: string;

  @Field((type) => ID)
  public addressId!: string;
}
