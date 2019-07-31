import { registerEnumType } from "type-graphql";

export enum UserStatus {
  APPROVED = "APPROVED",
  PENDING = "PENDING",
  BLACKLISTED = "BLACKLISTED",
}

registerEnumType(UserStatus, {
  name: "UserStatus",
});
