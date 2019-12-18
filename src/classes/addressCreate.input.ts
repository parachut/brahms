import { InputType, Field } from 'type-graphql';

@InputType()
export class AddressCreateInput {
  @Field()
  public city!: string;

  @Field({ nullable: true })
  public primary?: boolean;

  @Field({ nullable: true })
  public country?: string;

  @Field({ nullable: true })
  public email?: string;

  @Field({ nullable: true })
  public phone?: string;

  @Field()
  public state!: string;

  @Field()
  public street1!: string;

  @Field({ nullable: true })
  public street2?: string;

  @Field()
  public zip!: string;
}
