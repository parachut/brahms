import { createUnionType } from 'type-graphql';

import { StripeCard } from './stripeCard';
import { StripeBankAccount } from './stripeBankAccount';

export const StripeSource = createUnionType({
  name: 'StripeSource', // the name of the GraphQL union
  types: [StripeCard, StripeBankAccount], // array of object types classes
});
