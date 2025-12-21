import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigGroup } from '../../database/entities/config-group.entity';
import { BizModule } from '../../database/entities/biz-module.entity';
import { User } from '../user/entities/user.entity';
import { LumpEconInfo } from '../lump-econ-info/entities/lump-econ-info.entity';
import { LumpEconConfigService } from './lump-econ-config.service';
import { LumpEconConfigController } from './lump-econ-config.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ConfigGroup, BizModule, LumpEconInfo, User])],
  providers: [LumpEconConfigService],
  controllers: [LumpEconConfigController],
  exports: [LumpEconConfigService],
})
export class LumpEconConfigModule {}
