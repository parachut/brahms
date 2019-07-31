import { registerEnumType } from 'type-graphql';

export enum ShipmentStatus {
  UNKNOWN = 'UNKNOWN',
  PRETRANSIT = 'PRETRANSIT',
  INTRANSIT = 'INTRANSIT',
  OUTFORDELIVERY = 'OUTFORDELIVERY',
  DELIVERED = 'DELIVERED',
  AVAILABLEFORPICKUP = 'AVAILABLEFORPICKUP',
  RETURNTOSENDER = 'RETURNTOSENDER',
  FAILURE = 'FAILURE',
  CANCELLED = 'CANCELLED',
  ERROR = 'ERROR',
}

registerEnumType(ShipmentStatus, {
  name: 'ShipmentStatus',
});
