import { registerEnumType } from 'type-graphql';

export enum AuthenticationMethod {
  PUSH = 'PUSH',
  SMS = 'SMS',
  VOICE = 'VOICE',
}

registerEnumType(AuthenticationMethod, {
  name: 'AuthenticationMethod',
});
