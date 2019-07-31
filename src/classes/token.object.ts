import { Field, ObjectType } from 'type-graphql';

@ObjectType()
export class Token {
  @Field({ nullable: true })
  public token?: string;
}
