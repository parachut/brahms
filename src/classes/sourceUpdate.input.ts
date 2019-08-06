import { Field, InputType } from 'type-graphql';

@InputType()
export class SourceUpdateInput {
  @Field()
  public token!: string;

  @Field({ nullable: true })
  public accountId?: string;
}
