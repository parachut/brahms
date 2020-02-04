import { Field, ObjectType } from 'type-graphql';

@ObjectType()
export class Pricing {
  @Field({ nullable: true })
  currency?: string;

  @Field({ nullable: true })
  setupFee?: number;

  @Field()
  unitAmount!: number;
}
