import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Task } from '../../database/entities/task.entity';
import { User } from '../user/entities/user.entity';
import { ConfigGroup } from '../../database/entities/config-group.entity';
import { BizModule } from '../../database/entities/biz-module.entity';
import { PelletEconInfo } from '../pellet-econ-info/entities/pellet-econ-info.entity';

import { PelletEconCalcService } from './pellet-econ-calc.service';
import { PelletEconCalcController } from './pellet-econ-calc.controller';
import {PortPelletLumpInfo} from "../port-pellet-lump-info/entities/port-pellet-lump-info.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Task,
      User,
      ConfigGroup,
      BizModule,
      PelletEconInfo,
      PortPelletLumpInfo
    ]),
  ],
  providers: [PelletEconCalcService],
  controllers: [PelletEconCalcController],
  exports: [PelletEconCalcService],
})
export class PelletEconCalcModule {}
