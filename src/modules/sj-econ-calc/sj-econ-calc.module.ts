import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SjEconCalcService } from './sj-econ-calc.service';
import { SjEconCalcController } from './sj-econ-calc.controller';
import { Task } from '../../database/entities/task.entity';
import { SjEconInfo } from '../sj-econ-info/entities/sj-econ-info.entity';
import { User } from '../user/entities/user.entity';
import { ConfigGroup } from '../../database/entities/config-group.entity';
import { BizModule } from '../../database/entities/biz-module.entity';
import { SjRawMaterial } from '../sj-raw-material/entities/sj-raw-material.entity';
import { PortIronOreInfo } from '../port-iron-ore-info/entities/port-iron-ore-info.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Task, SjEconInfo, User, ConfigGroup, BizModule, SjRawMaterial, PortIronOreInfo]), // 添加 ConfigGroup 和 BizModule
  ],
  controllers: [SjEconCalcController],
  providers: [SjEconCalcService],
})
export class SjEconCalcModule {}
