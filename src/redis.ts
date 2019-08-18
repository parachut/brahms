import { RedisPubSub } from 'graphql-redis-subscriptions';
import Redis from 'ioredis';

export const redis = new Redis(process.env.REDIS_URL);

export const pubSub = new RedisPubSub({
  publisher: new Redis(process.env.REDIS_URL),
  subscriber: new Redis(process.env.REDIS_URL),
});
