import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Task } from '../../database/entities/task.entity';
import { User } from '../user/entities/user.entity';
import { ConfigGroup } from '../../database/entities/config-group.entity';
import { BizModule } from '../../database/entities/biz-module.entity';
import { MixCoalCalcService } from './mix-coal-calc.service';
import { MixCoalCalcController } from './mix-coal-calc.controller';
import { CoalEconInfo } from '../coal-econ-info/entities/coal-econ-info.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Task,
      User,
      ConfigGroup,
      BizModule,
      CoalEconInfo
    ]),
  ],
  providers: [MixCoalCalcService],
  controllers: [MixCoalCalcController],
  exports: [MixCoalCalcService],
})
export class MixCoalCalcModule {}
