import { Field, ObjectType } from 'type-graphql';

@ObjectType()
export class AddressFormatted {
  @Field()
  public line1!: string;

  @Field()
  public line2!: string;
}
