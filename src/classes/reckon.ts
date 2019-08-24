import { Field, ID, Int, ObjectType } from 'type-graphql';

@ObjectType()
export class Reckon {
  @Field((type) => ID)
  public id!: string;

  @Field((type) => Int)
  public cartPoints!: number;

  @Field((type) => Int)
  public inUse!: number;

  @Field((type) => Int)
  public overage!: number;

  @Field()
  public monthly!: number;
}
