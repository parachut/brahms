import { InputType, Field } from 'type-graphql';

@InputType()
export class AddressCreateInput {
  @Field()
  public city!: string;

  @Field()
  public primary!: boolean;

  @Field({ nullable: true })
  public country?: string;

  @Field({ nullable: true })
  public email?: string;

  @Field({ nullable: true })
  public phone?: string;

  @Field()
  public state!: string;

  @Field()
  public street!: string;

  @Field({ nullable: true })
  public secondaryUnit?: string;

  @Field()
  public zip!: string;
}
