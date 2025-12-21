import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Task } from '../../database/entities/task.entity';
import { User } from '../user/entities/user.entity';
import { ConfigGroup } from '../../database/entities/config-group.entity';
import { BizModule } from '../../database/entities/biz-module.entity';
import { LumpEconInfo } from '../lump-econ-info/entities/lump-econ-info.entity';

import { LumpEconCalcService } from './lump-econ-calc.service';
import { LumpEconCalcController } from './lump-econ-calc.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Task,
      User,
      ConfigGroup,
      BizModule,
      LumpEconInfo,
    ]),
  ],
  providers: [LumpEconCalcService],
  controllers: [LumpEconCalcController],
  exports: [LumpEconCalcService],
})
export class LumpEconCalcModule {}
