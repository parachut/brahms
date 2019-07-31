import { IsEmail, Length } from 'class-validator';
import { InputType, Field } from 'type-graphql';

@InputType()
export class RegisterInput {
  @Field()
  @IsEmail()
  public email!: string;

  @Field()
  public name!: string;

  @Field()
  @Length(10)
  public phone!: string;
}
