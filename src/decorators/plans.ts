import { createParamDecorator } from 'type-graphql';

const plans = {
  '1500': 149,
  '3500': 349,
  '750': 99,
  '7500': 499,
};

export interface Plans {
  '1500': number;
  '3500': number;
  '750': number;
  '7500': number;
}

export function Plans(plan: string = '1500') {
  return createParamDecorator(() => {
    return plans;
  });
}
