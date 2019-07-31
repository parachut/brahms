import { Field, ObjectType } from 'type-graphql';

@ObjectType()
export class CatalogSearchResult {
  @Field()
  public collection!: string;

  @Field()
  public name!: string;

  @Field()
  public slug!: string;
}
