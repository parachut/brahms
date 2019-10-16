import { Field, ObjectType } from 'type-graphql';

@ObjectType()
export class InventoryTotalIncome {
  @Field()
  public total!: Number;

  @Field()
  public days!: Number;
}
