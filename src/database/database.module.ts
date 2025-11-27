import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { User } from '../modules/user/entities/user.entity';
import { Task } from './entities/task.entity';
import { Result } from '../modules/sj-calc/entities/result.entity';
import { TaskLog } from '../modules/sj-calc/entities/task_log.entity';
import { Role } from '../modules/role/entities/role.entity';
import { SjRawMaterial } from '../modules/sj-raw-material/entities/sj-raw-material.entity';
import { SjCandidate } from 'src/modules/sj-candidate/entities/sj-candidate.entity';
import { SharedData } from 'src/modules/shared-data/entities/shared-data.entity';

// 新增的实体
import { BizModule } from './entities/biz-module.entity';
import { ConfigGroup } from './entities/config-group.entity';
import { ParameterHistory } from './entities/parameter-history.entity';
import { ChatMessage } from '../modules/chat/entities/chat-message.entity';
import { History } from '../modules/history/entities/history.entity';
import { ChatRoom } from 'src/modules/chat/entities/chat-room.entity';
import { Menu } from 'src/modules/menu/entity/menu.entity';

// 数据库配置

export const databaseConfig: TypeOrmModuleOptions = {
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '123456',
  database: process.env.DB_NAME || 'iron_cost_system1101',
  driver:require('mysql2'),
  entities: [
    User,
    Task,
    Result,
    TaskLog,
    Role,
    SjRawMaterial,
    BizModule,
    ConfigGroup,
    ParameterHistory,
    ChatMessage,
    History,
    SjCandidate,
    SharedData,
    ChatRoom,
    Menu
  ],
  synchronize: false, // 开发环境可用，生产环境建议 false 并使用 migration
  migrations: ['src/migrations/*{.ts,.js}'],
  
};
