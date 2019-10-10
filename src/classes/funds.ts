import { Field, ObjectType } from 'type-graphql';

@ObjectType()
export class Funds {
  @Field()
  public available!: number;

  @Field()
  public totalIncome!: number;

  @Field()
  public totalDeposited!: number;
}
