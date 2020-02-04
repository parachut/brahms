import { Field, ID, ObjectType } from 'type-graphql';

@ObjectType()
export class TransactionPaymentGateway {
  @Field((type) => ID)
  id!: string;

  @Field()
  name!: string;

  @Field()
  object!: string;

  @Field()
  type!: string;
}
