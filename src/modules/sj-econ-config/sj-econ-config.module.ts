import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SjEconConfigController } from './sj-econ-config.controller';
import { SjEconConfigService } from './sj-econ-config.service';
import { ConfigGroup } from '../../database/entities/config-group.entity';
import { BizModule } from '../../database/entities/biz-module.entity';
import { User } from '../user/entities/user.entity';
import { SjEconInfo } from '../sj-econ-info/entities/sj-econ-info.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ConfigGroup, BizModule, User, SjEconInfo]),
  ],
  controllers: [SjEconConfigController],
  providers: [SjEconConfigService],
  exports: [SjEconConfigService],
})
export class SjEconConfigModule {}

