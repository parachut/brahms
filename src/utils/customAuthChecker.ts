import difference from 'lodash/difference';
import { AuthChecker } from 'type-graphql';
import { IContext } from './context.interface';
import { UserRole } from '../enums/userRole';

export const customAuthChecker: AuthChecker<IContext> = (
  { root, args, context, info },
  roles: UserRole[],
  strict: boolean = false,
) => {
  const { user } = context;
  // here you can read user from context
  // and check his permission in db against `roles` argument
  // that comes from `@Authorized`, eg. ["ADMIN", "MODERATOR"]
  if (roles.length === 0) {
    // if `@Authorized()`, check only is user exist
    return user !== undefined;
  }
  // there are some roles defined now

  if (!user) {
    // and if no user, restrict access
    return false;
  }

  if (!strict && roles.find((role) => user.roles.includes(role))) {
    return true;
  } else if (strict) {
    if (!difference(roles, user.roles).length) {
      return true;
    }
  }

  // no roles matched, restrict access
  return false;
};
