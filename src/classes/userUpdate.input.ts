import { InputType, Field, ID, Int } from 'type-graphql';

@InputType()
export class UserUpdateInput {
  @Field()
  public name!: string;

  @Field()
  public phone!: string;

  @Field()
  public email!: string;
}
