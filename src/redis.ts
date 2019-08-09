import { RedisPubSub } from 'graphql-redis-subscriptions';
import Redis from 'ioredis';

export const redis = new Redis(
  parseInt(process.env.REDIS_PORT),
  process.env.REDIS_HOST,
);

export const pubSub = new RedisPubSub({
  publisher: new Redis(
    parseInt(process.env.REDIS_PORT),
    process.env.REDIS_HOST,
  ),
  subscriber: new Redis(
    parseInt(process.env.REDIS_PORT),
    process.env.REDIS_HOST,
  ),
});
