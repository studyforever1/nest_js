import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ConfigGroup } from '../../database/entities/config-group.entity';
import { BizModule } from '../../database/entities/biz-module.entity';
import { User } from '../user/entities/user.entity';
import { PelletEconInfo } from '../pellet-econ-info/entities/pellet-econ-info.entity';

import { PelletEconConfigService } from './pellet-econ-config.service';
import { PelletEconConfigController } from './pellet-econ-config.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ConfigGroup, BizModule, PelletEconInfo, User])],
  controllers: [PelletEconConfigController],
  providers: [PelletEconConfigService],
  exports: [PelletEconConfigService],
})
export class PelletEconConfigModule {}
