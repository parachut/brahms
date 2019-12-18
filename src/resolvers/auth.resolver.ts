import { Client as Authy } from 'authy-client';
import crypto from 'crypto';
import Recurly from 'recurly';
import stringify from 'csv-stringify';
import { differenceInCalendarDays } from 'date-fns';
import fs from 'fs';
import jsonwebtoken from 'jsonwebtoken';
import { last } from 'lodash';
import pick from 'lodash/pick';
import sortBy from 'lodash/sortBy';
import { Op } from 'sequelize';
import { Arg, Authorized, Ctx, Mutation, Query, Resolver } from 'type-graphql';
import numeral from 'numeral';

import { signOptions } from '../../certs';
import { AuthenticateInput } from '../classes/authenticate.input';
import { RegisterInput } from '../classes/register.input';
import { Token } from '../classes/token.object';
import { RecurlySubscription } from '../classes/recurlySubscription';
import { Phone } from '../decorators/phone';
import { ShipmentDirection } from '../enums/shipmentDirection';
import { ShipmentType } from '../enums/shipmentType';
import { UserRole } from '../enums/userRole';
import { Inventory } from '../models/Inventory';
import { Product } from '../models/Product';
import { Shipment } from '../models/Shipment';
import { User } from '../models/User';
import { UserIntegration } from '../models/UserIntegration';
import { UserTermAgreement } from '../models/UserTermAgreement';
import { UserMarketingSource } from '../models/UserMarketingSource';
import { createQueue } from '../redis';
import { calcDailyCommission } from '../utils/calc';
import { IContext, IJWTPayLoad } from '../utils/context.interface';
import { sendEmail } from '../utils/sendEmail';

const privateKEY = fs.readFileSync('./certs/private.key', 'utf8');
const authy = new Authy({ key: process.env.AUTHY });

const integrationQueue = createQueue('integration-queue');
const communicationQueue = createQueue('communication-queue');
const recurly = new Recurly.Client(process.env.RECURLY, `subdomain-parachut`);

@Resolver(User)
export default class AuthResolver {
  @Authorized([UserRole.MEMBER])
  @Query((returns) => User)
  public async me(@Ctx() ctx: IContext) {
    if (ctx.user) {
      const user = await User.findOne({
        where: { id: ctx.user.id },
      });
      if (!user) {
        throw new Error('User not found');
      }
      return user;
    }
    throw new Error('User not found');
  }

  @Authorized([UserRole.MEMBER])
  @Query((returns) => RecurlySubscription, { nullable: true })
  public async subscription(@Ctx() ctx: IContext) {
    if (ctx.user) {
      try {
        const userIntegration = await UserIntegration.findOne({
          where: { key: 'RECURLY_SUBSCRIPTION' },
        });

        const subscription = await recurly.getSubscription(
          userIntegration.value,
        );

        let additionalItems = 0;

        if (
          subscription.addOns.find(
            (addon) => addon.addOn.name === 'Additional Items',
          )
        ) {
          additionalItems = subscription.addOns.find(
            (addon) => addon.addOn.name === 'Additional Items',
          ).quantity;
        }

        return {
          planName: subscription.plan.name,
          subtotal: subscription.subtotal,
          nextBillingDate: new Date(subscription.current_period_ends_at),
          additionalItems,
        };
      } catch (e) {
        return null;
      }
    }
    throw new Error('Not authorised');
  }

  @Mutation(() => Token)
  @Phone()
  public async authenticate(
    @Arg('input')
    { phone, passcode }: AuthenticateInput,
    @Ctx() ctx: IContext,
  ) {
    // Check if the user is valid
    const user = await User.findOne({
      where: { phone },
      include: ['integrations', 'geolocations'],
    });

    if (!user) {
      throw new Error('No user with that phone number.');
    }

    const authyIntegration = user.integrations.find(
      (integration) => integration.type === 'AUTHY',
    );

    if (!passcode) {
      await authy.requestSms({
        authyId: authyIntegration.value,
      });

      return { token: null };
    }

    await authy.verifyToken({
      authyId: authyIntegration.value,
      token: passcode,
    });

    ctx.analytics.identify({
      traits: {
        ...pick(user, ['name', 'email', 'phone']),
      },
      userId: user.id,
    });

    ctx.analytics.track({
      userId: user.id,
      event: 'Authenticate',
      properties: {
        ...pick(user, ['name', 'email', 'phone']),
      },
    });

    integrationQueue.add('update-user-geolocation', {
      userId: user.get('id'),
      ipAddress: ctx.clientIp,
    });

    const payload: IJWTPayLoad = {
      id: user.id,
      roles: [UserRole.MEMBER],
    };

    const token = jsonwebtoken.sign(payload, privateKEY, signOptions);
    const refreshToken = crypto.randomBytes(128).toString('hex');

    await ctx.redis.set(`refreshToken:${user.id}`, refreshToken);

    return { token, refreshToken };
  }

  @Mutation(() => UserTermAgreement)
  public async agreeToTerms(
    @Arg('type')
    type: String,
    @Ctx() ctx: IContext,
  ) {
    if (ctx.user) {
      const agree = new UserTermAgreement({
        type,
        agreed: true,
        userId: ctx.user.id,
      });

      await agree.save();

      return agree;
    }

    throw new Error('Unauthorized');
  }

  @Mutation(() => Token)
  @Phone()
  public async register(
    @Arg('input')
    { email, phone, name, marketingSource, roles }: RegisterInput,
    @Ctx() ctx: IContext,
  ) {
    // Find if there is an existing account
    const userExists = await User.findOne({
      where: { [Op.or]: [{ email }, { phone }] },
    });

    if (userExists) {
      throw new Error('Sorry, this user already exists, please try again.');
    }

    try {
      const phoneInformation = await authy.getPhoneInformation({
        countryCode: 'US',
        phone,
      });

      if (phoneInformation.type !== 'cellphone') {
        throw new Error('Phone number is not a cellphone.');
      }
    } catch (e) {
      console.log(JSON.stringify(e));
    }

    const filteredRoles =
      roles && roles.length
        ? roles.filter((role) =>
            [UserRole.CONTRIBUTOR, UserRole.MEMBER].includes(role),
          )
        : [UserRole.MEMBER];

    const user = await User.create({
      email,
      name,
      phone,
      roles: filteredRoles,
    });

    const agree = new UserTermAgreement({
      type: roles.length > 1 ? 'EARN' : 'ACCESS',
      agreed: true,
      userId: user.get('id'),
    });

    if (marketingSource) {
      await UserMarketingSource.create({
        ...marketingSource,
        userId: user.get('id'),
      });
    }

    integrationQueue.add('update-user-geolocation', {
      userId: user.get('id'),
      ipAddress: ctx.clientIp,
    });

    ctx.analytics.identify({
      traits: {
        ...pick(user, ['name', 'email', 'phone']),
      },
      userId: user.get('id'),
    });

    ctx.analytics.track({
      userId: user.get('id'),
      event: 'Register',
      properties: {
        ...pick(user, ['name', 'email', 'phone']),
      },
    });

    communicationQueue.add('send-simple-email', {
      to: user.email,
      id: filteredRoles.includes(UserRole.CONTRIBUTOR) ? 13193333 : 13136612,
      data: {
        name: user.parsedName.first,
      },
    });

    const payload: IJWTPayLoad = {
      id: user.get('id'),
      roles: filteredRoles,
    };

    const token = jsonwebtoken.sign(payload, privateKEY, signOptions);
    const refreshToken = crypto.randomBytes(128).toString('hex');

    await ctx.redis.set(`refreshToken:${user.id}`, refreshToken);

    return { token, refreshToken };
  }

  @Mutation(() => Boolean)
  public async exportInventoryHistory(
    @Ctx()
    ctx: IContext,
  ) {
    if (ctx.user) {
      const user = await User.findByPk(ctx.user.id);

      const inventories = await Inventory.findAll({
        where: {
          user_id: ctx.user.id,
        },
        include: ['product'],
      });

      let report: any[] = [];

      for (const inventory of inventories) {
        const groups: any[] = [];

        inventory.shipments = (await inventory.$get<Shipment>('shipments', {
          order: [['carrierReceivedAt', 'ASC']],
        })) as Shipment[];

        let shipments = inventory.shipments
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

        shipments.forEach((shipment, i) => {
          if (
            shipment.direction === ShipmentDirection.OUTBOUND &&
            shipment.carrierDeliveredAt
          ) {
            const access: any = {
              out: shipment.carrierDeliveredAt,
              in: null,
              amount: 0,
              days: 0,
              serial: inventory.serial,
              name: inventory.product.name,
            };

            groups.push(access);
          } else {
            last(groups).in = shipment.carrierReceivedAt;
          }

          const final = last(groups);

          if (
            final.in ||
            i === inventory.shipments.length - 1 ||
            final.in === null
          ) {
            final.days = differenceInCalendarDays(
              final.in || new Date(),
              final.out,
            );
            final.amount = numeral(
              calcDailyCommission(inventory.product.points) * final.days,
            ).format('$0,00.00');
          }
        });

        report = [...report, ...groups];
      }

      const columns = {
        name: 'Item name',
        serial: 'Serial number',
        out: 'Out date',
        in: 'Back date',
        days: 'Days in circulation',
        amount: 'Total earned',
      };

      stringify(
        report.map((r) => ({
          ...r,
          in: r.in ? r.in.toLocaleDateString() : null,
          out: r.out ? r.out.toLocaleDateString() : null,
          amount: r.amount ? numeral(r.amount).format('$0,00.00') : null,
          days: r.days ? numeral(r.days).format('0,00') : null,
        })),
        {
          header: true,
          columns,
        },
        async function(err, data) {
          const base64data = Buffer.from(data).toString('base64');

          await sendEmail({
            to: user.email,
            id: 14817794,
            data: {
              name: user.parsedName.first,
            },
            attachments: [
              {
                ContentID: 'history.csv',
                Content: base64data,
                ContentType: 'application/csv',
                Name: 'history.csv',
              },
            ],
          });
        },
      );

      return true;
    }

    throw new Error('Unauthorized');
  }
}
