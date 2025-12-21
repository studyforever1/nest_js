import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Task } from '../../database/entities/task.entity';
import { User } from '../user/entities/user.entity';
import { ConfigGroup } from '../../database/entities/config-group.entity';
import { BizModule } from '../../database/entities/biz-module.entity';
import { CokeEconInfo } from '../coke-econ-info/entities/coke-econ-info.entity';

import { CokeEconCalcService } from './coke-econ-calc.service';
import { CokeEconCalcController } from './coke-econ-calc.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Task, User, ConfigGroup, BizModule, CokeEconInfo]),
  ],
  providers: [CokeEconCalcService],
  controllers: [CokeEconCalcController],
  exports: [CokeEconCalcService],
})
export class CokeEconCalcModule {}
