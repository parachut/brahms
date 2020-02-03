import { UserRole } from '../enums/userRole';
import Analytics from 'analytics-node';
import Sequelize from 'sequelize';
import { Request } from 'express';

export type IJWTPayLoad = {
  id: string;
  roles: UserRole[];
};

export interface IContext {
  analytics: Analytics;
  clientIp: string;
  sequelize: Sequelize.Sequelize;
  user?: IJWTPayLoad;
  req: Request;
}
