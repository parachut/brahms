import { registerEnumType } from "type-graphql";

export enum InventoryCondition {
  NEW = "NEW",
  LIKENEW = "LIKENEW",
  EXCELLENT = "EXCELLENT",
  USED = "USED",
  DAMAGED = "DAMAGED",
}

registerEnumType(InventoryCondition, {
  name: "InventoryCondition",
});
