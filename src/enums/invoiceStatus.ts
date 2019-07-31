import { registerEnumType } from "type-graphql";

export enum InvoiceStatus {
  OPEN = "OPEN",
  COLLECTED = "COLLECTED",
  FAILED = "FAILED",
  COMPLIMENTARY = "COMPLIMENTARY",
  COLLECTIONS = "COLLECTIONS",
}

registerEnumType(InvoiceStatus, {
  name: "InvoiceStatus",
});
