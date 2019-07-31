import { UserRole } from '../enums/userRole';
import Analytics from 'analytics-node';
import Redis from 'ioredis';

export type IJWTPayLoad = {
  id: string;
  roles: UserRole[];
};

export interface IContext {
  analytics: Analytics;
  redis: Redis;
  user?: IJWTPayLoad;
}
