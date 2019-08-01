import { Field, ObjectType, ID, Int } from 'type-graphql';

@ObjectType()
export class StripeCard {
  @Field((type) => ID)
  public id!: string;

  @Field((type) => Int)
  public expYear!: number;

  @Field((type) => Int)
  public expMonth!: number;

  @Field()
  public funding!: string;

  @Field({ nullable: true })
  public country?: string;

  @Field()
  public brand!: string;

  @Field()
  public last4!: string;

  @Field()
  public object!: string;

  @Field()
  public name!: string;
}
