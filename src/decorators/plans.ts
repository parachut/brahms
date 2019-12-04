import { createParamDecorator } from 'type-graphql';

export const plans = {
  '1500': 149,
  '3500': 349,
  '750': 99,
  '7500': 499,
  'level-1': 249,
  'level-2': 399,
  'level-3': 499,
};

export interface Plans {
  '1500': number;
  '3500': number;
  '750': number;
  '7500': number;
  'level-1': number;
  'level-2': number;
  'level-3': number;
}

export function Plans(plan: string = '1500') {
  return createParamDecorator(() => {
    return plans;
  });
}
