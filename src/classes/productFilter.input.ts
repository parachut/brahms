import { InputType, Field, ID, Int } from 'type-graphql';

@InputType()
export class ProductFilterInput {
  @Field((type) => ID, { nullable: true })
  public id?: string;

  @Field((type) => String, { nullable: true })
  public search?: string;

  @Field((type) => String, { nullable: true })
  public brand?: string;

  @Field((type) => Boolean, { nullable: true, defaultValue: false })
  public inStock?: boolean;

  @Field((type) => Int, { nullable: true, defaultValue: 100000 })
  public maxPoints?: number;

  @Field((type) => Int, { nullable: true, defaultValue: 0 })
  public minPoints?: number;
}
