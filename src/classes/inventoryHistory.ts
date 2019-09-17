import { Field, ObjectType } from 'type-graphql';

@ObjectType()
export class InventoryHistory {
  @Field({ nullable: true })
  public in?: Date;

  @Field()
  public out!: Date;

  @Field()
  public amount!: number;

  @Field()
  public days!: number;
}
