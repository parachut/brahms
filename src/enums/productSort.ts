import { registerEnumType } from 'type-graphql';

export enum ProductSort {
  ID_DESC = 'ID_DESC',
  ID_ASC = 'ID_ASC',
  SLUG_DESC = 'SLUG_DESC',
  SLUG_ASC = 'SLUG_ASC',
  POPULARITY_ASC = 'POPULARITY_ASC',
  POPULARITY_DESC = 'POPULARITY_DESC',
  STOCK_ASC = 'STOCK_ASC',
  STOCK_DESC = 'STOCK_DESC',
  LAST_INVENTORY_CREATED_ASC = 'LAST_INVENTORY_CREATED_ASC',
  LAST_INVENTORY_CREATED_DESC = 'LAST_INVENTORY_CREATED_DESC',
}

registerEnumType(ProductSort, {
  name: 'ProductSort',
});
