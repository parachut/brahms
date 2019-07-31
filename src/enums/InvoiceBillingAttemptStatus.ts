import { registerEnumType } from "type-graphql";

export enum InvoiceBillingAttemptStatus {
  OPEN = "OPEN",
  SUCCESS = "SUCCESS",
  FAIL = "FAIL",
  INVALID = "INVALID",
  REFUND = "REFUND",
}

registerEnumType(InvoiceBillingAttemptStatus, {
  name: "InvoiceBillingAttemptStatus",
});
