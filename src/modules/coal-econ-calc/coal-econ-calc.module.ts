import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Task } from '../../database/entities/task.entity';
import { User } from '../user/entities/user.entity';
import { ConfigGroup } from '../../database/entities/config-group.entity';
import { BizModule } from '../../database/entities/biz-module.entity';
import { CoalEconInfo } from '../coal-econ-info/entities/coal-econ-info.entity';

import { CoalEconCalcService } from './coal-econ-calc.service';
import { CoalEconCalcController } from './coal-econ-calc.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Task,
      User,
      ConfigGroup,
      BizModule,
      CoalEconInfo,
    ]),
  ],
  providers: [CoalEconCalcService],
  controllers: [CoalEconCalcController],
  exports: [CoalEconCalcService],
})
export class CoalEconCalcModule {}
