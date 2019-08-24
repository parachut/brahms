import { Field, Int, ObjectType } from 'type-graphql';

import { Address } from '../models/Address';
import { PaymentMethod } from './paymentMethod';

@ObjectType()
export class BillingInformation {
  @Field()
  public id!: string;

  @Field((type) => Address)
  public address!: Address;

  @Field((type) => PaymentMethod)
  public paymentMethod!: PaymentMethod;

  @Field()
  public firstName!: string;

  @Field()
  public lastname!: string;
}
