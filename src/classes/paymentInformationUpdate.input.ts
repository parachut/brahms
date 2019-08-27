import { Field, InputType, ID } from 'type-graphql';

import { AddressCreateInput } from './addressCreate.input';

@InputType()
export class PaymentInformationUpdateInput {
  @Field()
  public token!: string;
}
