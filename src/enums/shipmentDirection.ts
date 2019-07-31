import { registerEnumType } from "type-graphql";

export enum ShipmentDirection {
  INBOUND = "INBOUND",
  OUTBOUND = "OUTBOUND",
}

registerEnumType(ShipmentDirection, {
  name: "ShipmentDirection",
});
