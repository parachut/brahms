import { createMethodDecorator } from 'type-graphql';
import PhoneNumber from 'awesome-phonenumber';

export function Phone(region: string = 'US') {
  return createMethodDecorator(async ({ args }, next) => {
    if (args.input.phone && !args.input.phone.startsWith('+')) {
      const pn = new PhoneNumber(args.input.phone, region);

      if (!pn.isValid()) {
        throw new Error('Phone number is not valid.');
      }

      args.input.phone = pn.getNumber();

      if (args.input.phone) {
        args.input.phone = args.input.phone.trim();
      }
    }

    return next();
  });
}
