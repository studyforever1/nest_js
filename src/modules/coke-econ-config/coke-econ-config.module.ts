// coke-econ-config.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ConfigGroup } from '../../database/entities/config-group.entity';
import { BizModule } from '../../database/entities/biz-module.entity';
import { User } from '../user/entities/user.entity';
import { CokeEconInfo } from '../coke-econ-info/entities/coke-econ-info.entity';

import { CokeEconConfigService } from './coke-econ-config.service';
import { CokeEconConfigController } from './coke-econ-config.controller';

@Module({
  imports: [
    // 注册 TypeORM 实体，确保依赖注入可用
    TypeOrmModule.forFeature([
      ConfigGroup,
      BizModule,
      CokeEconInfo,
      User,
    ]),
  ],
  controllers: [CokeEconConfigController],
  providers: [CokeEconConfigService],
  exports: [CokeEconConfigService],
})
export class CokeEconConfigModule {}
