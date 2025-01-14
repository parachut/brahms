import { Field, InputType, ID } from 'type-graphql';

@InputType()
export class PaymentInformationUpdateInput {
  @Field()
  public token!: string;
}
