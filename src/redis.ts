import { RedisPubSub } from 'graphql-redis-subscriptions';
import Redis from 'ioredis';
import Queue from 'bull';

console.log(process.env.REDIS_URL);

export const redis = new Redis(process.env.REDIS_URL);
const client = new Redis(process.env.REDIS_URL);
const subscriber = new Redis(process.env.REDIS_URL);

export const pubSub = new RedisPubSub({
  publisher: client,
  subscriber,
});

export function createQueue(name: string): InstanceType<Queue> {
  return new Queue(name, process.env.REDIS_URL);
}
