import { registerEnumType } from "type-graphql";

export enum VerificationType {
  EMAIL = "EMAIL",
  PHONE = "PHONE",
  ADDRESS = "ADDRESS",
  JUMIO = "JUMIO",
}

registerEnumType(VerificationType, {
  name: "VerificationType",
});
