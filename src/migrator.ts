import { prisma } from '@parachut/prisma';
import EasyPost from '@easypost/api';
import omit from 'lodash/omit';
import pick from 'lodash/pick';
import pMap from 'p-map';
import sequelize from 'sequelize';
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
import { Warehouse } from './models/Warehouse';

import { UserStatus } from './enums/userStatus';

const easyPost = new EasyPost(process.env.EASYPOST);

const concurrency = 250;

const moveUsers = async () => {
  const userIds: any = {};
  let users = await prisma.users({ orderBy: 'id_ASC' });

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
      status: UserStatus.APPROVED,
      stripeId: stripe ? stripe.value : undefined,
    });
  });

  try {
    const userModels = await pMap(
      newUsers,
      async (cat: User) => await User.create(cat),
      {
        concurrency,
        stopOnError: true,
      },
    );

    console.log(users.length, userModels.length);

    users.forEach((user, i) => {
      if (user) {
        const newUser = userModels.find((u) => u.email === user.email);

        if (newUser) {
          userIds[user.id] = newUser.get('id');
        }
      }
    });

    return userIds;
  } catch (e) {
    console.log(e);
  }
};

const moveUserIntegrations = async (userIds) => {
  const newIntegrations: any = [];

  const users: any = await prisma.users({ orderBy: 'id_ASC' })
    .$fragment(`fragment UserIntegration on User {
      id
      integrations {
        key
        value
      }
  } `);

  users.forEach((user, i) => {
    if (userIds[user.id]) {
      user.integrations.forEach((integration) => {
        newIntegrations.push({
          type: integration.key,
          value: integration.value,
          userId: user.id,
        });
      });
    }
  });

  await UserIntegration.bulkCreate(newIntegrations, { individualHooks: true });

  return true;
};

const moveBrands = async () => {
  const brandIds: any = {};
  const brands = await prisma.brands({ orderBy: 'id_ASC' });

  const newBrands: any = [];

  for (const brand of brands) {
    newBrands.push(omit(brand, ['id']));
  }

  const brandModels = await pMap(newBrands, (cat: Brand) => Brand.create(cat), {
    concurrency,
  });

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

  const fileModels = await pMap(newFiles, (cat: File) => File.create(cat), {
    concurrency,
  });

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

  const warehouseModels = await pMap(
    newWarehouses,
    (cat: Warehouse) => Warehouse.create(cat),
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

  const categoryModels = await await pMap(
    newCategories,
    (cat: Category) => Category.create(cat),
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

  const addressModels = await pMap(
    newAddresses,
    async (cat: Address) => {
      try {
        const address = await Address.create(cat);
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

  const productModels = await pMap(
    newProducts,
    (cat: Product) => Product.create(cat),
    {
      concurrency,
    },
  );

  products.forEach((product, i) => {
    productIds[product.id] = productModels[i].get('id');
  });

  const changeFiles = [];

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

  await pMap(changeFiles, (cat: any) => File.update(cat[0], cat[1]), {
    concurrency,
  });

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

  const inventoryModels = await pMap(
    newInventory,
    async (cat: Inventory) => {
      try {
        console.log(cat);
        const newInventory = await Inventory.create(cat);
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

  for (const item of inventoriesExtra) {
    if (item.status === 'INWAREHOUSE') {
      await Product.update(
        {
          stock: sequelize.literal('stock + 2'),
        },
        {
          where: {
            id: productIds[item.product.id],
          },
        },
      );
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
      inventory: items[i].inventory.map((ii: any) => inventoryIds[ii.id]),
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

  const cartModels = await pMap(newCarts, (cat: Cart) => Cart.create(cat), {
    concurrency,
  });

  carts.forEach((cart, i) => {
    cartIds[cart.id] = cartModels[i].get('id');
  });

  newCartItems.forEach((item, i) => {
    item.cartId = cartIds[item._id];
  });

  const cartItemModels = await pMap(
    newCartItems,
    (cat: CartItem) => CartItem.create(cat),
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

  const shipmentModels = await pMap(
    newShipments,
    (cat: Shipment) => Shipment.create(cat),
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
  console.log('start');
  const userIds = await moveUsers();
  console.log('user');

  const fileIds = await moveFiles();
  console.log('files');
  const brandIds = await moveBrands();
  console.log('brand');
  const cateogryIds = await moveCategories();
  console.log('category');
  const productIds = await moveProducts(brandIds, cateogryIds, fileIds);
  console.log('product');
  const inventoryIds = await moveInventory(productIds, userIds);
  console.log('inventory');

  const addressIds = await moveAddresses(userIds);
  console.log('address');
  const warehouseIds = await moveWarehouses();
  console.log('warehouse');

  const cartIds = await moveCarts(
    productIds,
    userIds,
    inventoryIds,
    addressIds,
  );
  console.log('carts');
  const shipmentIds = await moveShipments(
    userIds,
    inventoryIds,
    cartIds,
    addressIds,
    warehouseIds,
  );
  console.log('shipments');
  res.send('done');
};
