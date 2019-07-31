import { Field, ObjectType } from 'type-graphql';

@ObjectType()
export class CartTransitTime {
  @Field()
  public service!: string;

  @Field()
  public arrival!: Date;
}
