import { Field, Int, ObjectType } from 'type-graphql';

import { Address } from '../models/Address';
import { PaymentMethod } from './paymentMethod';

@ObjectType()
export class PaymentInformation {
  @Field()
  public id!: string;

  @Field((type) => PaymentMethod)
  public paymentMethod!: PaymentMethod;

  @Field()
  public firstName!: string;

  @Field()
  public lastName!: string;
}
