import { Field, ObjectType } from 'type-graphql';

@ObjectType()
export class PaymentMethod {
  @Field()
  accountType!: string;

  @Field({ nullable: true })
  billingAgreementId?: string;

  @Field({ nullable: true })
  cardType?: string;

  @Field({ nullable: true })
  expMonth?: number;

  @Field({ nullable: true })
  expYear?: number;

  @Field({ nullable: true })
  firstSix?: string;

  @Field({ nullable: true })
  lastFour?: string;

  @Field()
  object!: string;

  @Field({ nullable: true })
  routingNumber?: string;

  @Field({ nullable: true })
  routingNumberBank?: string;
}
