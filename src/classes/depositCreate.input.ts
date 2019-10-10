import { InputType, Field } from 'type-graphql';

@InputType()
export class DepositCreateInput {
  @Field()
  public amount!: number;
}
