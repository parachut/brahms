import { IsEmail, Length } from 'class-validator';
import { InputType, Field } from 'type-graphql';

import { UserRole } from '../enums/userRole';
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

  @Field((type) => [UserRole], { nullable: true })
  public roles?: UserRole[];

  @Field({ nullable: true })
  public desiredPlan?: string;

  @Field((type) => [String], { nullable: true })
  public selfDescription?: [string];

  @Field((type) => MarketingSourceInput, { nullable: true })
  public marketingSource?: MarketingSourceInput;
}
