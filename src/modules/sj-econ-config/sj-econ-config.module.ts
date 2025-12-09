import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SjEconConfigController } from './sj-econ-config.controller';
import { SjEconConfigService } from './sj-econ-config.service';
import { ConfigGroup } from '../../database/entities/config-group.entity';
import { BizModule } from '../../database/entities/biz-module.entity';
import { User } from '../user/entities/user.entity';
import { SjRawMaterial } from '../sj-raw-material/entities/sj-raw-material.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ConfigGroup, BizModule, User, SjRawMaterial]),
  ],
  controllers: [SjEconConfigController],
  providers: [SjEconConfigService],
  exports: [SjEconConfigService],
})
export class SjEconConfigModule {}

