import algoliasearch from 'algoliasearch';
import { addDays, differenceInCalendarDays } from 'date-fns';
import last from 'lodash/last';
import sortBy from 'lodash/sortBy';
import { Op, Sequelize } from 'sequelize';
const { Client } = require('@elastic/elasticsearch');

import { InventoryCondition } from './enums/inventoryCondition';
import { InventoryStatus } from './enums/inventoryStatus';
import { ShipmentDirection } from './enums/shipmentDirection';
import { ShipmentType } from './enums/shipmentType';
import { Income } from './models/Income';
import { Inventory } from './models/Inventory';
import { calcDailyCommission, calcDailyRate } from './utils/calc';
import { User } from './models/User';
import { Category } from './models/Category';
import { Product } from './models/Product';

// Database Name
const dbName = 'parachut';

// Create a new MongoClient
// const client = new MongoClient(process.env.MONGO_URI);

const inventoryConditionMap = {
  New: InventoryCondition.NEW,
  'Like New': InventoryCondition.LIKENEW,
  Excellent: InventoryCondition.EXCELLENT,
  Used: InventoryCondition.USED,
  Damaged: InventoryCondition.DAMAGED,
};

const inventoryStatusMap = {
  Queue: InventoryStatus.NEW,
  Pending: InventoryStatus.PENDING,
  Accepted: InventoryStatus.ACCEPTED,
  Shipped: InventoryStatus.ENROUTEWAREHOUSE,
  'In Review': InventoryStatus.INSPECTING,
  Active: InventoryStatus.INWAREHOUSE,
  'Return Requested': InventoryStatus.RETURNING,
  Returned: InventoryStatus.RETURNED,
  Sold: InventoryStatus.RETURNED,
  'Not Approved': InventoryStatus.PENDING,
  Damaged: InventoryStatus.OUTOFSERVICE,
};

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: {
    ssl: true,
  },
});

export const migrator = async (req, res) => {
  /**
  client.connect(function(err, client) {
    if (err) {
      console.log(err);
    }

    const db = client.db(dbName);

    const col = db.collection('users');
    const iCol = db.collection('inventories');
    const pCol = db.collection('products');

    col.find({ earnForm: true }).toArray(async function(err, docs) {
      for (const doc of docs) {
        try {
          const user = await User.findOne({
            where: {
              [Op.or]: [{ email: doc.email }, { phone: doc.phone }],
            },
            include: ['integrations', 'addresses'],
          });

          if (user) {
            console.log('update user');
            if (!user.integrations.find((i) => i.type === 'AUTHY')) {
              console.log('update authy');
              await UserIntegration.create({
                type: 'AUTHY',
                value: doc.authyId,
                userId: user.get('id'),
              });
            }

            if (
              doc.expressAccount &&
              doc.expressAccount !== '' &&
              !user.integrations.find((i) => i.type === 'STRIPE_EXPRESS')
            ) {
              console.log('update express');
              await UserIntegration.create({
                type: 'STRIPE_EXPRESS',
                value: doc.expressAccount,
                userId: user.get('id'),
              });
            }

            if (
              doc.frontId &&
              doc.frontId !== '' &&
              !user.integrations.find((i) => i.type === 'FRONT')
            ) {
              console.log('update front');
              await UserIntegration.create({
                type: 'FRONT',
                value: doc.frontId,
                userId: user.get('id'),
              });
            }

            const roles = [UserRole.MEMBER];
            if (doc.earnForm) {
              roles.push(UserRole.CONTRIBUTOR);
            }

            user.roles = roles;
            await user.save();
          } else {
            const roles = [UserRole.MEMBER];
            if (doc.earnForm) {
              roles.push(UserRole.CONTRIBUTOR);
            }

            const newUser = await User.create({
              name: doc.name.first.trim() + ' ' + doc.name.last.trim(),
              email: doc.email,
              phone: doc.phone,
              roles,
              businessName: doc.businessName,
            });

            console.log('New User');

            await UserIntegration.create({
              type: 'AUTHY',
              value: doc.authyId,
              userId: newUser.get('id'),
            });

            if (doc.expressAccount && doc.expressAccount !== '') {
              await UserIntegration.create({
                type: 'STRIPE_EXPRESS',
                value: doc.expressAccount,
                userId: newUser.get('id'),
              });
            }

            if (doc.frontId && doc.frontId !== '') {
              await UserIntegration.create({
                type: 'FRONT',
                value: doc.frontId,
                userId: newUser.get('id'),
              });
            }
          }

          if (doc.address && doc.address.street1 && !user.addresses.length) {
            console.log('create address');
            await Address.create({
              street: doc.address.street1 + ' ' + doc.address.street2,
              city: doc.address.suburb,
              state: doc.address.state,
              zip: doc.address.postcode,
              country: 'US',
              userId: user.get('id'),
            });
          }

          iCol
            .find({ owner: new ObjectId(doc._id) })
            .toArray(async function(err, docs) {
              console.log(docs.length);
              for (const item of docs) {
                let inventory = null;
                if (item.serial) {
                  inventory = await Inventory.findOne({
                    where: {
                      serial: item.serial,
                    },
                  });
                }

                if (!inventory) {
                  pCol.findOne(
                    { _id: new ObjectId(item.product) },
                    async function(err, pdoc) {
                      if (pdoc) {
                        const filter = [];

                        if (pdoc.mfr) {
                          filter.push({ mfr: pdoc.mfr });
                        }

                        if (pdoc.fullName) {
                          filter.push({ name: pdoc.fullName });
                        }

                        const product = await Product.findOne({
                          where: {
                            [Op.or]: filter,
                          },
                        });

                        if (product) {
                          const userInventory = await Inventory.findOne({
                            where: {
                              productId: product.id,
                              userId: user.get('id'),
                            },
                          });

                          if (!userInventory) {
                            console.log(item.status);
                            const invItem = await Inventory.create({
                              condition: inventoryConditionMap[item.condition],
                              serial: item.serial,
                              userId: user.get('id'),
                              productId: product.id,
                              status: inventoryStatusMap[item.status],
                            });

                            console.log(invItem.get('id'));
                          } else {
                            console.log(
                              'user inventory',
                              userInventory.id,
                              item.createdAt,
                            );
                            await sequelize.query(
                              'UPDATE inventories SET created_at = :created_at WHERE id = :id',
                              {
                                replacements: {
                                  id: userInventory.id,
                                  created_at: new Date(item.createdAt),
                                },
                                type: QueryTypes.UPDATE,
                              },
                            );
                          }
                        } else {
                          console.log('cant import');
                        }
                      }
                    },
                  );
                } else {
                  console.log('found inventory', item.createdAt);
                  await sequelize.query(
                    'UPDATE inventories SET created_at = :created_at WHERE id = :id',
                    {
                      replacements: {
                        id: inventory.id,
                        created_at: new Date(item.createdAt),
                      },
                      type: QueryTypes.UPDATE,
                    },
                  );
                }
              }
            });
        } catch (e) {
          console.log(e);
        }
      }
    });
  });
*/

  /* var stripe = require('stripe')(process.env.STRIPE);

  const users = await User.findAll({
    include: ['inventory', 'integrations'],
  });

  let i = 0;
  for (const user of users.filter((u) => u.inventory.length)) {
    const stripeConnect = user.integrations.find(
      (i) => i.type === 'STRIPE_EXPRESS',
    );

    if (stripeConnect) {
      i = i + 1;

      setTimeout(() => {
        stripe.transfers.list(
          {
            limit: 100,
            destination: stripeConnect.value,
          },
          async function(err, transfers) {
            if (transfers && transfers.data.length) {
              for (const transfer of transfers.data) {
                if (!transfer.reversed) {
                  await Deposit.create({
                    amount: Number((transfer.amount / 100).toFixed(2)),
                    userId: user.id,
                    legacy: true,
                    notes: 'Imported from stripe',
                    createdAt: new Date(transfer.created),
                  });
                }
              }
            }
          },
        );
      }, i * 10000);
    }
  } */

  /** const inventory = await Inventory.findAll({
    where: {
      userId: { [Op.ne]: '367c7df6-3f36-4df6-abf3-5ea7c2418878' },
    },
    include: [
      {
        association: 'shipments',
        include: ['user'],
        order: [['carrierReceivedAt', 'ASC']],
      },
      {
        association: 'product',
      },
    ],
  });

  for (const item of inventory) {
    const groups: any[] = [];

    let shipments = item.shipments
      .filter((ship) => ship.type === ShipmentType.ACCESS)
      .filter(
        (ship) =>
          (ship.direction === ShipmentDirection.OUTBOUND &&
            ship.carrierDeliveredAt) ||
          (ship.direction === ShipmentDirection.INBOUND &&
            ship.carrierReceivedAt),
      );

    shipments = sortBy(shipments, (ship) =>
      ship.carrierReceivedAt
        ? ship.carrierReceivedAt.getTime()
        : ship.carrierDeliveredAt.getTime(),
    );

    console.log(
      shipments.map((ship) => ({
        id: ship.id,
        direction: ship.direction,
        carrierReceivedAt: ship.carrierReceivedAt,
      })),
    );

    shipments
      .filter((ship) => ship.type === ShipmentType.ACCESS)
      .forEach((shipment, i) => {
        if (
          shipment.direction === ShipmentDirection.OUTBOUND &&
          shipment.carrierDeliveredAt
        ) {
          const access: any = {
            out: shipment.carrierDeliveredAt,
            in: null,
            shipment,
          };

          groups.push(access);
        } else if (
          shipment.direction === ShipmentDirection.INBOUND &&
          shipment.carrierReceivedAt
        ) {
          console.log(groups, item.id);
          if (groups.length) {
            last(groups).in = shipment.carrierReceivedAt;
          }
        }
      });

    for (const access of groups) {
      access.days = differenceInCalendarDays(
        access.in ? access.in : new Date(),
        access.out,
      );
      const mapped = [];

      for (let i = 0; i < access.days; i++) {
        mapped.push({
          planId: access.shipment.user.planId,
          commission: calcDailyCommission(item.product.points),
          membership: !!access.shipment.user.planId,
          dailyRate: calcDailyRate(item.product.points),
          memberId: access.shipment.user.id,
          userId: item.userId,
          inventoryId: item.id,
          createdAt: addDays(access.out, i),
        });
      }

      Income.bulkCreate(mapped);
    }
  } */
  /*
  const users = await User.findAll({
    where: {
      '$incomes.id$': { [Op.ne]: null },
    },
    include: ['deposits', 'incomes'],
  });

  for (const user of users) {
    if (user.incomes.length) {
      const totalIncome =
        Math.floor(user.incomes.reduce((r, i) => r + i.commission, 0) * 100) /
        100;
      const totalDeposited =
        Math.floor(user.deposits.reduce((r, i) => r + i.amount, 0) * 100) / 100;

      console.log(
        user.email,
        totalIncome - totalDeposited,
        totalIncome,
        totalDeposited,
      );
    }
  }

  */

  /*
  const categories = await Category.findAll({});

  function findBreadCrumbs(cat: Category): Category[] {
    const _categories = [cat];

    const getParent = async (child: Category) => {
      if (child.parentId) {
        const parent = categories.find((cate) => cate.id === child.parentId);

        if (parent) {
          _categories.push(parent);

          if (parent.parentId) {
            getParent(parent);
          }
        }
      }
    };

    getParent(cat);
    return _categories;
  }

  for (const category of categories) {
    console.log(category.id);
    findBreadCrumbs(category);
  }

  */

  /*
  console.log('start');

  const elasti = new Client({
    node:
      'https://avnadmin:dxceju1p3zefthxn@es-1c0c548d-parachut-222d.aivencloud.com:21267',
  });

  const products = await Product.findAll({
    include: ['brand', 'category'],
  });

  await elasti.indices.create(
    {
      index: 'products',
      body: {
        mappings: {
          properties: {
            id: { type: 'text' },
            name: { type: 'text' },
            brand: {
              type: 'object',
              properties: {
                name: { type: 'text' },
                id: { type: 'text' },
                slug: { type: 'text' },
              },
            },
            slug: { type: 'text' },
            popularity: { type: 'integer' },
            images: { type: 'text' },
            demand: { type: 'integer' },
            points: { type: 'integer' },
            stock: { type: 'integer' },
            createdAt: { type: 'date' },
            lastInventoryCreated: { type: 'date' },
          },
        },
      },
    },
    { ignore: [400] },
  );

  const dataset = products.map((product) => ({
    id: product.id,
    name: product.name,
    brand: product.brand
      ? {
          name: product.brand.name,
          id: product.brand.id,
          slug: product.brand.slug,
        }
      : null,
    slug: product.slug,
    stock: product.stock,
    points: product.points,
    images: product.images,
    popularity: product.popularity,
    demand: product.demand,
    lastInventoryCreated: product.lastInventoryCreated,
  }));

  const body = dataset.flatMap((doc) => [
    { index: { _index: 'products' } },
    doc,
  ]);

  const { body: bulkResponse } = await elasti.bulk({ refresh: true, body });

  if (bulkResponse.errors) {
    const erroredDocuments = [];
    // The items array has the same order of the dataset we just indexed.
    // The presence of the `error` key indicates that the operation
    // that we did for the document has failed.
    bulkResponse.items.forEach((action, i) => {
      const operation = Object.keys(action)[0];
      if (action[operation].error) {
        erroredDocuments.push({
          // If the status is 429 it means that you can retry the document,
          // otherwise it's very likely a mapping error, and you should
          // fix the document before to try it again.
          status: action[operation].status,
          error: action[operation].error,
          operation: body[i * 2],
          document: body[i * 2 + 1],
        });
      }
    });
    console.log(erroredDocuments);
  }

  const { body: count } = await elasti.count({ index: 'products' });
  console.log(count);

  */

  const elasti = new Client({
    node:
      'https://avnadmin:dxceju1p3zefthxn@es-1c0c548d-parachut-222d.aivencloud.com:21267',
  });

  try {
    await elasti.updateByQuery({
      index: 'products',
      body: {
        query: {
          match: { id: '5e4a15fb-4688-4f29-8f3b-41a15184d3a3' },
        },
        script: {
          source: 'ctx._source.stock = params.newStock',
          params: {
            newStock: 0,
          },
        },
      },
    });
  } catch (e) {
    console.log(JSON.stringify(e));
  }

  res.send(200);
};
