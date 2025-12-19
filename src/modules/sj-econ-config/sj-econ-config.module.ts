// sj-econ-config.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigGroup } from '../../database/entities/config-group.entity';
import { BizModule } from '../../database/entities/biz-module.entity';
import { SjEconInfo } from '../sj-econ-info/entities/sj-econ-info.entity';
import { User } from '../user/entities/user.entity';
import { SjEconConfigService } from './sj-econ-config.service';
import { SjEconConfigController } from './sj-econ-config.controller';

@Module({
  imports: [
    // 注册 TypeORM 实体，确保依赖注入可用
    TypeOrmModule.forFeature([ConfigGroup, BizModule, SjEconInfo, User]),
  ],
  controllers: [SjEconConfigController],
  providers: [SjEconConfigService],
  exports: [SjEconConfigService],
})
export class SjEconConfigModule {}
