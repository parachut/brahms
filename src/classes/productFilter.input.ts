import { InputType, Field, ID, Int } from 'type-graphql';

@InputType()
export class ProductFilterInput {
  @Field((type) => ID, { nullable: true })
  public id?: string;

  @Field((type) => String, { nullable: true })
  public search?: string;

  @Field((type) => String, { nullable: true })
  public category?: string;

  @Field((type) => String, { nullable: true })
  public brand?: string;

  @Field((type) => Boolean, { nullable: true })
  public inStock?: boolean;
}
