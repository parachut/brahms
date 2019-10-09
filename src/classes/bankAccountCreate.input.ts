import { Field, InputType, ID } from 'type-graphql';

@InputType()
export class BankAccountCreateInput {
  @Field()
  public accountId!: string;

  @Field()
  public token!: string;

  @Field({ nullable: true })
  public last4?: number;

  @Field({ nullable: true })
  public dob?: string;
}
