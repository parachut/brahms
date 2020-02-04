import { Field, ObjectType } from 'type-graphql';

@ObjectType()
export class BillingInfoUpdatedBy {
  @Field()
  country!: string;

  @Field()
  ip!: string;
}
