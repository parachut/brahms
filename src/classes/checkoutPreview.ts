import { Field, ObjectType } from 'type-graphql';

@ObjectType()
export class CheckoutPreview {
  @Field()
  public discount!: number;

  @Field()
  public subtotal!: number;

  @Field()
  public tax!: number;

  @Field()
  public total!: number;
}
