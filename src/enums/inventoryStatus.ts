import { registerEnumType } from "type-graphql";

export enum InventoryStatus {
  NEW = "NEW",
  PENDING = "PENDING",
  ACCEPTED = "ACCEPTED",
  ENROUTEWAREHOUSE = "ENROUTEWAREHOUSE",
  INSPECTING = "INSPECTING",
  INWAREHOUSE = "INWAREHOUSE",
  SHIPMENTPREP = "SHIPMENTPREP",
  ENROUTEMEMBER = "ENROUTEMEMBER",
  WITHMEMBER = "WITHMEMBER",
  RETURNING = "RETURNING",
  OUTOFSERVICE = "OUTOFSERVICE",
  ENROUTEOWNER = "ENROUTEOWNER",
  RETURNED = "RETURNED",
  STOLEN = "STOLEN",
  LOST = "LOST",
}

registerEnumType(InventoryStatus, {
  name: "InventoryStatus",
});
