import { Field, ObjectType } from 'type-graphql';

@ObjectType()
export class PaymentMethod {
  @Field()
  public cardType!: string;

  @Field()
  public lastFour!: string;
}
