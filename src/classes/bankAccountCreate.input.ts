import { Field, InputType, ID } from 'type-graphql';

@InputType()
export class BankAccountCreateInput {
  @Field()
  public accountId!: string;

  @Field()
  public token!: string;
}
