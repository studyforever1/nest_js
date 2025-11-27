import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// ========== 实体导入 ==========
// 化学成分相关实体
import { SjFinesChemTyp } from './entities/sj-fines-chem-typ.entity';
import { MineTypInd } from './entities/mine-typ-ind.entity';
import { LumpPelletHtProp } from './entities/lump-pellet-ht-prop.entity';
import { FinesHtBaseProp } from './entities/fines-ht-base-prop.entity';

// 经济信息相关实体
import { LumpEconInfo } from './entities/lump-econ-info.entity';
import { LumpEconConfig } from './entities/lump-econ-config.entity';
import { PelletEconConfig } from './entities/pellet-econ-config.entity';
import { PelletEconInfo } from './entities/pellet-econ-info.entity';
import { CoalEconConfig } from './entities/coal-econ-config.entity';
import { CoalEconInfo } from './entities/coal-econ-info.entity';
import { CokeEconConfig } from './entities/coke-econ-config.entity';
import { CokeEconInfo } from './entities/coke-econ-info.entity';
import { SjEconConfig } from './entities/sj-econ-config.entity';
import { SjEconInfo } from './entities/sj-econ-info.entity';
import { PortMaterialInfo } from './entities/port-material-info.entity';

// 用户权限相关实体（用于权限验证）
import { User } from '../user/entities/user.entity';
import { Role } from '../role/entities/role.entity';


// 配置相关实体
import { ConfigGroup } from '../../database/entities/config-group.entity';
import { BizModule } from '../../database/entities/biz-module.entity';

// ========== 服务导入 ==========
// 化学成分相关服务
import { SjFinesChemTypService } from './services/sj-fines-chem-typ.service';
import { MineTypIndService } from './services/mine-typ-ind.service';
import { LumpPelletHtPropService } from './services/lump-pellet-ht-prop.service';
import { FinesHtBasePropService } from './services/fines-ht-base-prop.service';

// 经济信息相关服务
import { LumpEconInfoService } from './services/lump-econ-info.service';
import { LumpEconConfigService } from './services/lump-econ-config.service';
import { PelletEconConfigService } from './services/pellet-econ-config.service';
import { PelletEconInfoService } from './services/pellet-econ-info.service';
import { CoalEconConfigService } from './services/coal-econ-config.service';
import { CoalEconInfoService } from './services/coal-econ-info.service';
import { CokeEconConfigService } from './services/coke-econ-config.service';
import { CokeEconInfoService } from './services/coke-econ-info.service';
import { SjEconConfigService } from './services/sj-econ-config.service';
import { SjEconInfoService } from './services/sj-econ-info.service';
import { PortMaterialInfoService } from './services/port-material-info.service';

// ========== 控制器导入 ==========
// 化学成分相关控制器
import { SjFinesChemTypController } from './controllers/sj-fines-chem-typ.controller';
import { MineTypIndController } from './controllers/mine-typ-ind.controller';
import { LumpPelletHtPropController } from './controllers/lump-pellet-ht-prop.controller';
import { FinesHtBasePropController } from './controllers/fines-ht-base-prop.controller';

// 经济信息相关控制器
import { LumpEconInfoController } from './controllers/lump-econ-info.controller';
import { LumpEconConfigController } from './controllers/lump-econ-config.controller';
import { PelletEconConfigController } from './controllers/pellet-econ-config.controller';
import { PelletEconInfoController } from './controllers/pellet-econ-info.controller';
import { CoalEconConfigController } from './controllers/coal-econ-config.controller';
import { CoalEconInfoController } from './controllers/coal-econ-info.controller';
import { CokeEconConfigController } from './controllers/coke-econ-config.controller';
import { CokeEconInfoController } from './controllers/coke-econ-info.controller';
import { SjEconConfigController } from './controllers/sj-econ-config.controller';
import { SjEconInfoController } from './controllers/sj-econ-info.controller';
import { PortMaterialInfoController } from './controllers/port-material-info.controller';

// ========== 公共服务导入 ==========
import { FileService } from '../../common/services/file.service';
import { StatisticsService } from '../../common/services/statistics.service';

/**
 * 铁矿数据模块
 * 
 * 统一管理所有铁矿相关的数据模块，包括：
 * - 化学成分数据（烧结矿粉、矿山指标、块矿球团等）
 * - 经济信息数据（各种原料的价格和配置信息）
 * - 港口原料信息
 * 
 * 模块特点：
 * - 完整的CRUD操作支持
 * - Excel导入导出功能
 * - 数据统计分析
 * - JWT认证和权限控制
 * - 统一的错误处理
 * 
 * @example
 * ```typescript
 * // 在其他模块中使用
 * @Module({
 *   imports: [IronOreDataModule],
 * })
 * export class SomeModule {}
 * ```
 */
@Module({
  imports: [
    // 注册所有实体到TypeORM
    TypeOrmModule.forFeature([
      // 化学成分相关实体
      SjFinesChemTyp,
      MineTypInd,
      LumpPelletHtProp,
      FinesHtBaseProp,
      
      // 经济信息相关实体
      LumpEconInfo,
      LumpEconConfig,
      PelletEconConfig,
      PelletEconInfo,
      CoalEconConfig,
      CoalEconInfo,
      CokeEconConfig,
      CokeEconInfo,
      SjEconConfig,
      SjEconInfo,
      PortMaterialInfo,
      
      // 用户权限相关实体（用于权限验证）
      User,
      Role,
      
      // 配置相关实体
      ConfigGroup,
      BizModule,
    ]),
  ],
  // 注册所有控制器
  controllers: [
    // 化学成分相关控制器
    SjFinesChemTypController,
    MineTypIndController,
    LumpPelletHtPropController,
    FinesHtBasePropController,
    
    // 经济信息相关控制器
    LumpEconInfoController,
    LumpEconConfigController,
    PelletEconConfigController,
    PelletEconInfoController,
    CoalEconConfigController,
    CoalEconInfoController,
    CokeEconConfigController,
    CokeEconInfoController,
    SjEconConfigController,
    SjEconInfoController,
    PortMaterialInfoController,
  ],
  // 注册所有服务提供者
  providers: [
    // 化学成分相关服务
    SjFinesChemTypService,
    MineTypIndService,
    LumpPelletHtPropService,
    FinesHtBasePropService,
    
    // 经济信息相关服务
    LumpEconInfoService,
    LumpEconConfigService,
    PelletEconConfigService,
    PelletEconInfoService,
    CoalEconConfigService,
    CoalEconInfoService,
    CokeEconConfigService,
    CokeEconInfoService,
    SjEconConfigService,
    SjEconInfoService,
    PortMaterialInfoService,
    
    // 公共服务
    FileService,
    StatisticsService,
  ],
  // 导出服务供其他模块使用
  exports: [
    // 化学成分相关服务
    SjFinesChemTypService,
    MineTypIndService,
    LumpPelletHtPropService,
    FinesHtBasePropService,
    
    // 经济信息相关服务
    LumpEconInfoService,
    LumpEconConfigService,
    PelletEconConfigService,
    PelletEconInfoService,
    CoalEconConfigService,
    CoalEconInfoService,
    CokeEconConfigService,
    CokeEconInfoService,
    SjEconConfigService,
    SjEconInfoService,
    PortMaterialInfoService,
  ],
})
export class IronOreDataModule {}
