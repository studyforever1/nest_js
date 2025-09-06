import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { User } from '../modules/user/entities/user.entity';
import { CalcTask } from '../modules/calc/entities/task.entity';
import { Result } from '../modules/calc/entities/result.entity';
import { ResultVersion } from './entities/result-version.entity';
import { TaskLog } from '../modules/calc/entities/task_log.entity';

export const databaseConfig: TypeOrmModuleOptions = {
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '123456',
  database: process.env.DB_NAME || 'iron_cost_system',
  entities: [User, CalcTask, Result, ResultVersion,TaskLog],
  synchronize: true, // 开发环境可用，生产环境建议 false 并使用 migration
};
