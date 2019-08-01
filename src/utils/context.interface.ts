import { UserRole } from '../enums/userRole';
import Analytics from 'analytics-node';
import Redis from 'ioredis';
import Sequelize from 'sequelize';

export type IJWTPayLoad = {
  id: string;
  roles: UserRole[];
};

export interface IContext {
  analytics: Analytics;
  redis: Redis;
  sequelize: Sequelize.Sequelize;
  user?: IJWTPayLoad;
}
