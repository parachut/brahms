import { Field, ObjectType, ID } from 'type-graphql';

@ObjectType()
export class StripeBankAccount {
  @Field((type) => ID)
  public id!: string;

  @Field({ nullable: true })
  public accountHolderName?: string;

  @Field({ nullable: true })
  public bankName?: string;

  @Field({ nullable: true })
  public country?: string;

  @Field({ nullable: true })
  public currency?: string;

  @Field()
  public last4!: string;

  @Field()
  public object!: string;

  @Field()
  public status!: string;
}
