import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SBalanceCalcService } from './s-balance-calc.service';
import { SBalanceCalcController } from './s-balance-calc.controller';
import { ConfigGroup } from '../../database/entities/config-group.entity';
import { SjRawMaterial } from '../sj-raw-material/entities/sj-raw-material.entity';
import { Task } from '../../database/entities/task.entity';
import { Result } from '../../database/entities/result.entity';
import { User } from '../user/entities/user.entity';
import { BizModule } from '../../database/entities/biz-module.entity';
import { SjconfigService } from '../sj-config/sj-config.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ConfigGroup, SjRawMaterial, Task, Result, User, BizModule]),
  ],
  providers: [SBalanceCalcService, SjconfigService],
  controllers: [SBalanceCalcController],
})
export class SBalanceCalcModule {}
