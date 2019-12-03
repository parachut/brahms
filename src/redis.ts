import Redis from 'ioredis';
import Queue from 'bull';

export const redis = new Redis(process.env.REDIS_URL);

export function createQueue(name: string): InstanceType<Queue> {
  return new Queue(name, process.env.REDIS_URL);
}
