import { IsEmail, Length } from 'class-validator';
import { InputType, Field } from 'type-graphql';

@InputType()
export class MarketingSourceInput {
  @Field()
  public campaign!: string;

  @Field()
  public source?: string;

  @Field()
  public medium!: string;
}
