import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { User } from '../modules/user/entities/user.entity';
import { Task } from './entities/task.entity';
import { Result } from '../modules/calc/entities/result.entity';
import { TaskLog } from '../modules/calc/entities/task_log.entity';
import { Role } from '../modules/role/entities/role.entity';
import { Permission } from '../modules/permission/entities/permission.entity';
import {SjRawMaterial} from "../modules/sj-raw-material/entities/sj-raw-material.entity";

export const databaseConfig: TypeOrmModuleOptions = {
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '123456',
  database: process.env.DB_NAME || 'iron_cost_system',
  entities: [User, Task, Result,TaskLog, Role, Permission,SjRawMaterial],
  synchronize: true, // 开发环境可用，生产环境建议 false 并使用 migration
};
