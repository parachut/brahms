import { InputType, Field } from 'type-graphql';

@InputType()
export class BankAccountWhereInput {
  @Field({ nullable: true })
  public primary?: boolean;
}
