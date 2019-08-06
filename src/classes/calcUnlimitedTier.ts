import { Field, Int, ObjectType } from 'type-graphql';

@ObjectType()
export class CalcUnlimitedTier {
  @Field()
  public id!: string;

  @Field((type) => Int)
  public cartPoints!: number;

  @Field((type) => Int)
  public currentPoints!: number;

  @Field()
  public monthly!: number;

  @Field()
  public nextBilling!: Date;

  @Field()
  public overage!: number;

  @Field((type) => Int)
  public points!: number;

  @Field((type) => Int)
  public pointsOver!: number;

  @Field()
  public recommended!: string;

  @Field()
  public total!: number;

  @Field()
  public upgradeCost!: number;
}
