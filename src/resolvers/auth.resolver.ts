import { Client as Authy } from 'authy-client';
import Queue from 'bull';
import crypto from 'crypto';
import fs from 'fs';
import jsonwebtoken from 'jsonwebtoken';
import pick from 'lodash/pick';
import { Op } from 'sequelize';
import { Arg, Authorized, Ctx, Mutation, Query, Resolver } from 'type-graphql';

import { signOptions } from '../../certs';
import { AuthenticateInput } from '../classes/authenticate.input';
import { RegisterInput } from '../classes/register.input';
import { Token } from '../classes/token.object';
import { Phone } from '../decorators/phone';
import { UserRole } from '../enums/userRole';
import { User } from '../models/User';
import { IContext, IJWTPayLoad } from '../utils/context.interface';

const privateKEY = fs.readFileSync('./certs/private.key', 'utf8');
const authy = new Authy({ key: process.env.AUTHY });

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const updateUserGeolocationQueue = new Queue(
  'update-user-geolocation',
  REDIS_URL,
);

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

    updateUserGeolocationQueue.add({
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

  @Mutation(() => Token)
  @Phone()
  public async register(
    @Arg('input')
    { email, phone, name }: RegisterInput,
    @Ctx() ctx: IContext,
  ) {
    // Find if there is an existing account
    const userExists = await User.findOne({
      where: { [Op.or]: [{ email }, { phone }] },
    });

    if (userExists) {
      throw new Error('User already exists with these parameters.');
    }

    const phoneInformation = await authy.getPhoneInformation({
      countryCode: 'US',
      phone,
    });

    if (phoneInformation.type !== 'cellphone') {
      throw new Error('Phone number is not a cellphone.');
    }

    const user = await User.create({
      email,
      name,
      phone,
    });

    updateUserGeolocationQueue.add({
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

    const payload: IJWTPayLoad = {
      id: user.get('id'),
      roles: [UserRole.MEMBER],
    };

    const token = jsonwebtoken.sign(payload, privateKEY, signOptions);
    const refreshToken = crypto.randomBytes(128).toString('hex');

    await ctx.redis.set(`refreshToken:${user.id}`, refreshToken);

    return { token, refreshToken };
  }
}
