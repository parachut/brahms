import { InputType, Field } from 'type-graphql';

@InputType()
export class AddressUpdateInput {
  @Field({ nullable: true })
  public city?: string;

  @Field({ nullable: true })
  public primary?: boolean;

  @Field({ nullable: true })
  public country?: string;

  @Field({ nullable: true })
  public email?: string;

  @Field({ nullable: true })
  public phone?: string;

  @Field({ nullable: true })
  public state?: string;

  @Field({ nullable: true })
  public street?: string;

  @Field({ nullable: true })
  public zip?: string;
}
