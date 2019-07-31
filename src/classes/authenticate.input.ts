import { IsEmail, Length } from 'class-validator';
import { InputType, Field } from 'type-graphql';

@InputType()
export class AuthenticateInput {
  @Field()
  @Length(10)
  public phone!: string;

  @Field({ nullable: true })
  @Length(6)
  public passcode?: string;
}
