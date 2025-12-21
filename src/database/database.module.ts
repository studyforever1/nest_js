import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { User } from '../modules/user/entities/user.entity';
import { Task } from './entities/task.entity';
import { Result } from './entities/result.entity';
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
import { GlMaterialInfo } from 'src/modules/gl-material-info/entities/gl-material-info.entity';
import { GlFuelInfo } from 'src/modules/gl-fuel-info/entities/gl-fuel-info.entity';
import { SjEconInfo } from 'src/modules/sj-econ-info/entities/sj-econ-info.entity';
import { CokeEconInfo } from 'src/modules/coke-econ-info/entities/coke-econ-info.entity';
import {CoalEconInfo} from 'src/modules/coal-econ-info/entities/coal-econ-info.entity';
import {PelletEconInfo} from 'src/modules/pellet-econ-info/entities/pellet-econ-info.entity';
import {LumpEconInfo} from 'src/modules/lump-econ-info/entities/lump-econ-info.entity';
import {FinesHtBaseProp} from 'src/modules/fines-ht-base-prop/entities/fines-ht-base-prop.entity';
import {LumpMetallurgyProp} from 'src/modules/lump-metallurgy-prop/entities/lump-metallurgy-prop.entity';
import {MineTypInd} from 'src/modules/mine-typ-ind/entities/mine-typ-ind.entity';
import {SjFinesChemTyp} from 'src/modules/sj-fines-chem-typ/entities/sj-fines-chem-typ.entity';
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
    Menu,
    GlMaterialInfo,
    GlFuelInfo,
    SjEconInfo,
    CokeEconInfo,
    CoalEconInfo,
    PelletEconInfo,
    LumpEconInfo,
    FinesHtBaseProp,
    LumpMetallurgyProp,
    MineTypInd,
    SjFinesChemTyp
  ],
  synchronize: true, // 开发环境可用，生产环境建议 false 并使用 migration
  migrations: ['src/migrations/*{.ts,.js}'],
  
};
