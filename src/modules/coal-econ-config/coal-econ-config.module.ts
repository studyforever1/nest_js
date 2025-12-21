import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ConfigGroup } from '../../database/entities/config-group.entity';
import { BizModule } from '../../database/entities/biz-module.entity';
import { User } from '../user/entities/user.entity';
import { CoalEconInfo } from '../coal-econ-info/entities/coal-econ-info.entity';

import { CoalEconConfigService } from './coal-econ-config.service';
import { CoalEconConfigController } from './coal-econ-config.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ConfigGroup,
      BizModule,
      CoalEconInfo,
      User,
    ]),
  ],
  providers: [CoalEconConfigService],
  controllers: [CoalEconConfigController],
  exports: [CoalEconConfigService],
})
export class CoalEconConfigModule {}
