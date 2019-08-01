import EasyPost from '@easypost/api';
import { prisma } from '@parachut/prisma';
import Redis from 'ioredis';
import omit from 'lodash/omit';
import pick from 'lodash/pick';
import pMap from 'p-map';
import ProgressBar from 'progress';
import sequelize from 'sequelize';

import { UserStatus } from './enums/userStatus';
import { Address } from './models/Address';
import { Brand } from './models/Brand';
import { Cart } from './models/Cart';
import { CartItem } from './models/CartItem';
import { Category } from './models/Category';
import { File } from './models/File';
import { Inventory } from './models/Inventory';
import { Product } from './models/Product';
import { Shipment } from './models/Shipment';
import { User } from './models/User';
import { UserIntegration } from './models/UserIntegration';
import { UserVerification } from './models/UserVerification';
import { Warehouse } from './models/Warehouse';

const easyPost = new EasyPost(process.env.EASYPOST);
const redis = new Redis(
  parseInt(process.env.REDIS_PORT),
  process.env.REDIS_HOST,
);

const concurrency = 500;

const moveUsers = async () => {
  const userIds: any = {};
  let users = await prisma.users({ orderBy: 'id_ASC' });

  const bar = new ProgressBar('moving users [:bar] :rate/rps :percent :etas', {
    complete: '=',
    incomplete: ' ',
    width: 20,
    total: users.length,
  });

  const integrations: any = await prisma.users({ orderBy: 'id_ASC' })
    .$fragment(`fragment UserIntegration on User {
    integrations {
      key
      value
    }
  } `);

  const newUsers: any = [];

  users.forEach((user, i) => {
    const stripe = integrations[i].integrations.find(
      (integration) => integration.key === 'STRIPE',
    );

    newUsers.push({
      ...pick(user, [
        'name',
        'email',
        'phone',
        'businessName',
        'billingHour',
        'planId',
        'points',
        'roles',
      ]),
      points: user.points ? user.points : 0,
      status: UserStatus.APPROVED,
      stripeId: stripe ? stripe.value : undefined,
    });
  });

  const userModels = await pMap(
    newUsers,
    async (cat: User) => {
      const user = await User.create(cat);
      bar.tick();
      return user;
    },
    {
      concurrency,
      stopOnError: true,
    },
  );

  users.forEach((user, i) => {
    if (user) {
      const newUser = userModels.find((u) => u.email === user.email);

      if (newUser) {
        userIds[user.id] = newUser.get('id');
      }
    }
  });

  return userIds;
};

const moveUserIntegrations = async (userIds) => {
  const newIntegrations: any = [];
  const newVerifications: any = [];

  const users: any = await prisma.users({ orderBy: 'id_ASC' })
    .$fragment(`fragment UserIntegration234 on User {
      id
      integrations {
        key
        value
      }
      verifications(where: {type: JUMIO }) {
        verified
        type
        jumio {
          verificationStatus
          idScanResults
          idScanSource
          idCheckDataPositions
          idCheckDocumentValidation
          idCheckHologram
          idCheckMRZcode
          idCheckMicroprint
          idCheckSecurityFeatures
          idCheckSignature
          transactionDate
          idType
          idSubtype
          idCountry
          rejectReason
          idFirstName
          idLastName
          idDob
          idExpiry
          idUsState
          identityVerification {
            similarity
            validity
            reason
          }
        }
      }
  } `);

  users.forEach((user, i) => {
    if (userIds[user.id]) {
      user.integrations.forEach((integration) => {
        newIntegrations.push({
          type: integration.key,
          value: integration.value,
          userId: userIds[user.id],
        });
      });

      user.verifications.forEach((verification) => {
        newVerifications.push({
          type: 'INDENTITY',
          verified: verification.verified,
          meta: verification.jumio,
          userId: userIds[user.id],
        });
      });
    }
  });

  const bar = new ProgressBar(
    'moving usermeta [:bar] :rate/rps :percent :etas',
    {
      complete: '=',
      incomplete: ' ',
      width: 20,
      total: newIntegrations.length + newVerifications.length,
    },
  );

  await pMap(
    newIntegrations,
    async (cat: UserIntegration) => {
      const res = await UserIntegration.create(cat);
      bar.tick();
      return res;
    },
    {
      concurrency,
      stopOnError: true,
    },
  );

  await pMap(
    newVerifications,
    async (cat: UserVerification) => {
      const res = await UserVerification.create(cat);
      bar.tick();
      return res;
    },
    {
      concurrency,
      stopOnError: true,
    },
  );

  return true;
};

const moveBrands = async () => {
  const brandIds: any = {};
  const brands = await prisma.brands({ orderBy: 'id_ASC' });

  const newBrands: any = [];

  for (const brand of brands) {
    newBrands.push(omit(brand, ['id']));
  }

  const bar = new ProgressBar('moving brands [:bar] :rate/rps :percent :etas', {
    complete: '=',
    incomplete: ' ',
    width: 20,
    total: newBrands.length,
  });

  const brandModels = await pMap(
    newBrands,
    async (cat: Brand) => {
      const res = await Brand.create(cat);
      bar.tick();
      return res;
    },
    {
      concurrency,
    },
  );

  brands.forEach((brand, i) => {
    brandIds[brand.id] = brandModels[i].get('id');
  });

  return brandIds;
};

const moveFiles = async () => {
  const fileIds: any = {};
  const files = await prisma.files({ orderBy: 'id_ASC' });

  const newFiles: any = [];

  for (const file of files) {
    newFiles.push({
      filename: file.filename,
      contentType: file.mimetype,
    });
  }

  const bar = new ProgressBar('moving files [:bar] :rate/rps :percent :etas', {
    complete: '=',
    incomplete: ' ',
    width: 20,
    total: newFiles.length,
  });

  const fileModels = await pMap(
    newFiles,
    async (cat: File) => {
      const res = await File.create(cat);
      bar.tick();
      return res;
    },
    {
      concurrency,
    },
  );

  files.forEach((file, i) => {
    fileIds[file.id] = fileModels[i].get('id');
  });

  return fileIds;
};

const moveWarehouses = async () => {
  const warehouseIds: any = {};
  const warehouses = await prisma.warehouses({ orderBy: 'id_ASC' });

  const newWarehouses: any = [];

  for (const warehouse of warehouses) {
    newWarehouses.push({
      ...omit(warehouse, ['id']),
    });
  }

  const bar = new ProgressBar(
    'moving warehouses [:bar] :rate/rps :percent :etas',
    {
      complete: '=',
      incomplete: ' ',
      width: 20,
      total: newWarehouses.length,
    },
  );

  const warehouseModels = await pMap(
    newWarehouses,
    async (cat: Warehouse) => {
      const res = await Warehouse.create(cat);
      bar.tick();
      return res;
    },
    {
      concurrency,
    },
  );

  warehouses.forEach((warehouse, i) => {
    warehouseIds[warehouse.id] = warehouseModels[i].get('id');
  });

  return warehouseIds;
};

const moveCategories = async () => {
  const categoryIds: any = {};
  const categories = await prisma.categories({ orderBy: 'id_ASC' });

  const categorParents: any = await prisma.categories({ orderBy: 'id_ASC' })
    .$fragment(`fragment CategoryParents on Category {
      id
      parent {
        id
      }
  } `);

  const newCategories: any = [];

  for (const category of categories) {
    newCategories.push(omit(category, ['id']));
  }

  const bar = new ProgressBar(
    'moving categories [:bar] :rate/rps :percent :etas',
    {
      complete: '=',
      incomplete: ' ',
      width: 20,
      total: newCategories.length,
    },
  );

  const categoryModels = await await pMap(
    newCategories,
    async (cat: Category) => {
      const res = await Category.create(cat);
      bar.tick();
      return res;
    },
    { concurrency },
  );

  categories.forEach((cat, index) => {
    categoryIds[cat.id] = categoryModels[index].get('id');
  });

  let i = 0;
  for (const category of categorParents) {
    i = i + 1;

    if (category.parent) {
      await Category.update(
        {
          parentId: categoryIds[category.parent.id],
        },
        {
          where: {
            id: categoryModels[i].get('id'),
          },
        },
      );
    }
  }

  return categoryIds;
};

const moveAddresses = async (userIds) => {
  const addressIds: any = {};
  const addresses = await prisma.addresses({
    where: { user: { id_not: null } },
    orderBy: 'id_ASC',
  });

  const addressExtra: any = await prisma.addresses({
    where: { user: { id_not: null } },
    orderBy: 'id_ASC',
  }).$fragment(`fragment UserWithAddress on Address {
        user {
          id
        }
    } `);

  const newAddresses: any = [];

  addresses.forEach((address, i) => {
    newAddresses.push({
      ...omit(address, ['id']),
      userId: userIds[addressExtra[i].user.id],
      deletedAt: address.deletedAt ? new Date(address.deletedAt) : null,
    });
  });

  const bar = new ProgressBar(
    'moving addresses [:bar] :rate/rps :percent :etas',
    {
      complete: '=',
      incomplete: ' ',
      width: 20,
      total: newAddresses.length,
    },
  );

  const addressModels = await pMap(
    newAddresses,
    async (cat: Address) => {
      try {
        const address = await Address.create(cat);
        bar.tick();
        return address;
      } catch (e) {
        return null;
      }
    },
    {
      concurrency,
    },
  );

  addressModels
    .filter((addy) => !!addy)
    .forEach((address, index) => {
      const oAddress = addresses.find(
        (addy) => addy.easyPostId === address.easyPostId,
      );

      if (oAddress) {
        addressIds[oAddress.id] = address.get('id');
      }
    });

  return addressIds;
};

const moveProducts = async (brandIds, categoryIds, fileIds) => {
  const productIds: any = {};
  const products = await prisma.products({ orderBy: 'id_ASC' });

  const newProducts = [];

  const extraProducts: any = await prisma.products({ orderBy: 'id_ASC' })
    .$fragment(`fragment CartItemsWithProduct on CartItems {
      id
      brand {
        id
      }
      categories {
        id
      }
      images {
        id
      }
      images {
        id
        filename
      }
      features
      inTheBox
    } `);

  products.forEach((product, i) => {
    newProducts.push({
      ...omit(product, [
        'id',
        'width',
        'weight',
        'height',
        'shippingWeight',
        'depth',
      ]),
      brandId: brandIds[extraProducts[i].brand.id],
      categoryId:
        extraProducts[i].categories && extraProducts[i].categories.length
          ? categoryIds[extraProducts[i].categories[0].id]
          : null,
      features: extraProducts[i].features.map((f) => f.substring(0, 500)),
      inTheBox: extraProducts[i].inTheBox.map((f) => f.substring(0, 500)),
      images: extraProducts[i].images.map((file) => file.filename),
      lastInventoryCreated: new Date(),
      mfr: product.model,
    });
  });

  const bar = new ProgressBar(
    'moving products [:bar] :rate/rps :percent :etas',
    {
      complete: '=',
      incomplete: ' ',
      width: 20,
      total: newProducts.length,
    },
  );

  const productModels = await pMap(
    newProducts,
    async (cat: Product) => {
      const res = await Product.create(cat);
      bar.tick();
      return res;
    },
    {
      concurrency,
    },
  );

  products.forEach((product, i) => {
    productIds[product.id] = productModels[i].get('id');
  });

  const changeFiles = [];

  const bar2 = new ProgressBar(
    'updating product images [:bar] :rate/rps :percent :etas',
    {
      complete: '=',
      incomplete: ' ',
      width: 20,
      total: newProducts.length,
    },
  );

  for (const _product of extraProducts) {
    for (const file of _product.images) {
      changeFiles.push([
        {
          productId: productIds[_product.id],
        },
        {
          where: {
            id: fileIds[file.id],
          },
        },
      ]);
    }
  }

  await pMap(
    changeFiles,
    async (cat: any) => {
      await File.update(cat[0], cat[1]);
      bar2.tick();

      return true;
    },
    {
      concurrency,
    },
  );

  return productIds;
};

const moveInventory = async (productIds, userIds) => {
  const inventoryIds: any = {};
  const inventory = await prisma.inventories({ orderBy: 'id_ASC' });

  const newInventory: any = [];

  const inventoriesExtra: any = await prisma.inventories({ orderBy: 'id_ASC' })
    .$fragment(`fragment InventoryExtra on Inventory {
      id
      status
      product {
        id
      }
      user {
        id
      }
      member {
        id
      }
  } `);

  inventory.forEach((item, i) => {
    newInventory.push({
      ...pick(item, [
        'active',
        'autoPoints',
        'bin',
        'serial',
        'sku',
        'condition',
        'hasEssentials',
        'missingEssentials',
        'status',
      ]),
      missingEssentials: [],
      memberId: inventoriesExtra[i].member
        ? userIds[inventoriesExtra[i].member.id]
        : null,
      productId: productIds[inventoriesExtra[i].product.id],
      userId: userIds[inventoriesExtra[i].user.id],
    });
  });

  const bar = new ProgressBar(
    'moving inventory [:bar] :rate/rps :percent :etas',
    {
      complete: '=',
      incomplete: ' ',
      width: 20,
      total: newInventory.length,
    },
  );

  const inventoryModels = await pMap(
    newInventory,
    async (cat: Inventory) => {
      try {
        const newInventory = await Inventory.create(cat);
        bar.tick();
        return newInventory;
      } catch (e) {
        console.log(e);
        return;
      }
    },
    {
      concurrency,
    },
  );

  inventory.forEach((item, i) => {
    inventoryIds[item.id] = inventoryModels[i].get('id');
  });

  const bar2 = new ProgressBar(
    'updating stock [:bar] :rate/rps :percent :etas',
    {
      complete: '=',
      incomplete: ' ',
      width: 20,
      total: newInventory.length,
    },
  );

  for (const item of inventoriesExtra) {
    if (item.status === 'INWAREHOUSE') {
      await Product.update(
        {
          stock: sequelize.literal('stock + 1'),
        },
        {
          where: {
            id: productIds[item.product.id],
          },
        },
      );
      bar2.tick();
    }
  }

  return inventoryIds;
};

const moveCarts = async (productIds, userIds, inventoryIds, addressIds) => {
  const cartIds: any = {};
  const carts = await prisma.carts({ orderBy: 'id_ASC' });

  const items: any = await prisma.carts({ orderBy: 'id_ASC' })
    .$fragment(`fragment CartItemsWithProductShit on Cart {
      address {
        id
      }
        inventory {
          id
        }
        user {
          id
        }
        items {
          id
          quantity
          product {
            id
            points
          }
        }
     
    } `);

  const newCarts: any = [];
  const newCartItems: any = [];

  carts.forEach((cart, i) => {
    newCarts.push({
      ...omit(cart, ['id']),
      addressId: items[i].address ? addressIds[items[i].address.id] : null,
      canceledAt: cart.deletedAt,
      points: items[i].items.reduce((r, i) => r + (i.product.points || 0), 0),
      quantity: items[i].items.reduce((r, i) => r + (i.quantity || 0), 0),
      service: cart.service ? cart.service : 'Ground',
      userId: userIds[items[i].user.id],
    });

    const cartItems = items[i].items.map((item) => ({
      ...item,
      points: item.product.points,
      productId: productIds[item.product.id],
    }));

    cartItems.forEach((item) => {
      newCartItems.push({
        ...omit(item, ['id']),
        cartId: cart.id,
        quantity: parseInt(item.quantity, 10),
      });
    });
  });

  const bar = new ProgressBar('moving carts [:bar] :rate/rps :percent :etas', {
    complete: '=',
    incomplete: ' ',
    width: 20,
    total: newCarts.length,
  });

  const cartModels = await pMap(
    newCarts,
    async (cat: Cart) => {
      const res = await Cart.create(cat);
      bar.tick();
      return res;
    },
    {
      concurrency,
    },
  );

  const bar2 = new ProgressBar(
    'updating cart inventory [:bar] :rate/rps :percent :etas',
    {
      complete: '=',
      incomplete: ' ',
      width: 20,
      total: newCarts.length,
    },
  );

  let ci = 0;
  for (const cart of carts) {
    cartIds[cart.id] = cartModels[ci].get('id');
    if (items[ci].inventory.length) {
      await cartModels[ci].$set(
        'inventory',
        items[ci].inventory.map((ii: any) => inventoryIds[ii.id]),
      );
      bar2.tick();
    }
    ci = ci + 1;
  }

  newCartItems.forEach((item, i) => {
    item.cartId = cartIds[item.id];
  });

  const bar3 = new ProgressBar(
    'moving cart items [:bar] :rate/rps :percent :etas',
    {
      complete: '=',
      incomplete: ' ',
      width: 20,
      total: newCarts.length,
    },
  );

  const cartItemModels = await pMap(
    newCartItems,
    async (cat: CartItem) => {
      const res = await CartItem.create(cat);
      bar3.tick();
      return res;
    },
    {
      concurrency,
    },
  );

  return cartIds;
};

const moveShipments = async (
  userIds,
  inventoryIds,
  cartIds,
  addressIds,
  warehouseIds,
) => {
  const shipmentIds: any = {};
  const shipments = await prisma.shipments({ orderBy: 'id_ASC' });

  const shipmentExtra: any = await prisma.shipments({ orderBy: 'id_ASC' })
    .$fragment(`fragment ShipmentsWithProductShit on Shipment {
      address {
        id
      }
      cart {
        id
      }
        inventory {
          id
        }
        user {
          id
        }
     
    } `);

  const newShipments: any = [];

  shipments.forEach((shipment, i) => {
    newShipments.push({
      ...omit(shipment, ['id']),
      addressId: shipmentExtra[i].address
        ? addressIds[shipmentExtra[i].address.id]
        : null,
      cartId: shipmentExtra[i].cart ? cartIds[shipmentExtra[i].cart.id] : null,
      inventory: shipmentExtra[i].inventory.map(
        (ii: any) => inventoryIds[ii.id],
      ),
      service: shipment.service ? shipment.service : 'Ground',
      userId: userIds[shipmentExtra[i].user.id],
      warehouseId: warehouseIds[0],
    });
  });

  for (const shipment of newShipments) {
    if (shipment.easyPostId) {
      easyPost.shipment;
    }
  }

  const bar = new ProgressBar(
    'moving shipments [:bar] :rate/rps :percent :etas',
    {
      complete: '=',
      incomplete: ' ',
      width: 20,
      total: newShipments.length,
    },
  );

  const shipmentModels = await pMap(
    newShipments,
    async (cat: Shipment) => {
      const res = await Shipment.create(cat);
      bar.tick();
      return res;
    },
    {
      concurrency,
    },
  );

  shipments.forEach((cart, i) => {
    shipmentIds[cart.id] = shipmentModels[i].get('id');
  });

  return shipmentIds;
};

export const migrator = async (req, res) => {
  console.clear();
  console.log('Being migration...');
  let userIds = await redis.get('migration:userIds');

  if (!userIds) {
    userIds = await moveUsers();
    redis.set('migration:userIds', JSON.stringify(userIds));
    await moveUserIntegrations(userIds);
    console.log('Users completed!');
  } else {
    console.log('Skipping users');
    userIds = JSON.parse(userIds);
  }

  let fileIds = await redis.get('migration:fileIds');

  if (!fileIds) {
    fileIds = await moveFiles();
    redis.set('migration:fileIds', JSON.stringify(fileIds));
    console.log('Files completed!');
  } else {
    console.log('Skipping files');
    fileIds = JSON.parse(fileIds);
  }

  let brandIds = await redis.get('migration:brandIds');

  if (!brandIds) {
    brandIds = await moveBrands();
    redis.set('migration:brandIds', JSON.stringify(brandIds));
    console.log('Brands completed!');
  } else {
    console.log('Skipping brands');
    brandIds = JSON.parse(brandIds);
  }

  let cateogryIds = await redis.get('migration:cateogryIds');

  if (!cateogryIds) {
    cateogryIds = await moveCategories();
    redis.set('migration:cateogryIds', JSON.stringify(cateogryIds));
    console.log('Categories completed!');
  } else {
    console.log('Skipping categories');
    cateogryIds = JSON.parse(cateogryIds);
  }

  let productIds = await redis.get('migration:productIds');

  if (!productIds) {
    productIds = await moveProducts(brandIds, cateogryIds, fileIds);
    redis.set('migration:productIds', JSON.stringify(productIds));
    console.log('Products completed!');
  } else {
    console.log('Skipping products');
    productIds = JSON.parse(productIds);
  }

  let inventoryIds = await redis.get('migration:inventoryIds');

  if (!inventoryIds) {
    inventoryIds = await moveInventory(productIds, userIds);
    redis.set('migration:inventoryIds', JSON.stringify(inventoryIds));
    console.log('Inventory completed!');
  } else {
    console.log('Skipping inventory');
    inventoryIds = JSON.parse(inventoryIds);
  }

  let addressIds = await redis.get('migration:addressIds');

  if (!addressIds) {
    addressIds = await moveAddresses(userIds);
    redis.set('migration:addressIds', JSON.stringify(addressIds));
    console.log('Addresses completed!');
  } else {
    console.log('Skipping addresses');
    addressIds = JSON.parse(addressIds);
  }

  let warehouseIds = await redis.get('migration:warehouseIds');

  if (!warehouseIds) {
    warehouseIds = await moveWarehouses();
    redis.set('migration:warehouseIds', JSON.stringify(warehouseIds));
    console.log('Warehouses completed!');
  } else {
    console.log('Skipping warehouses');
    warehouseIds = JSON.parse(warehouseIds);
  }

  let cartIds = await redis.get('migration:cartIds');

  if (!cartIds) {
    cartIds = await moveCarts(productIds, userIds, inventoryIds, addressIds);
    redis.set('migration:cartIds', JSON.stringify(cartIds));
    console.log('Carts completed!');
  } else {
    console.log('Skipping carts');
    cartIds = JSON.parse(cartIds);
  }

  let shipmentIds = await redis.get('migration:shipmentIds');

  if (!shipmentIds) {
    shipmentIds = await moveShipments(
      userIds,
      inventoryIds,
      cartIds,
      addressIds,
      warehouseIds,
    );
    redis.set('migration:shipmentIds', JSON.stringify(shipmentIds));
    console.log('Shipments completed!');
  } else {
    console.log('Skipping shipments');
    shipmentIds = JSON.parse(shipmentIds);
  }

  res.send('done');
};
