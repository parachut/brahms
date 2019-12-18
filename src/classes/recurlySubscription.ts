import { Field, ObjectType } from 'type-graphql';

@ObjectType()
export class RecurlySubscription {
  @Field()
  public planName!: string;

  @Field()
  public subtotal!: number;

  @Field()
  public additionalItems!: number;

  @Field()
  public protectionPlan!: boolean;

  @Field()
  public nextBillingDate!: Date;
}
