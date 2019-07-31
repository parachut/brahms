import { registerEnumType } from "type-graphql";

export enum ShipmentType {
  ACCESS = "ACCESS",
  EARN = "EARN",
}

registerEnumType(ShipmentType, {
  name: "ShipmentType",
});
