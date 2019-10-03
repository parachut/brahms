import { IsEmail, Length } from 'class-validator';
import { InputType, Field } from 'type-graphql';

import { MarketingSourceInput } from './marketingSource.input';

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

  @Field({ nullable: true })
  public desiredPlan?: string;

  @Field({ nullable: true })
  public selfDescription?: [string];

  @Field((type) => MarketingSourceInput, { nullable: true })
  public marketingSource?: MarketingSourceInput;
}
