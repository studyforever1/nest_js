import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SjFixedCalcService } from './sj-fixed-calc.service';
import { SjFixedCalcController } from './sj-fixed-calc.controller';
import { ConfigGroup } from '../../database/entities/config-group.entity';
import { SjRawMaterial } from '../sj-raw-material/entities/sj-raw-material.entity';
import { Task } from '../../database/entities/task.entity';
import { Result } from '../../database/entities/result.entity';
import { User } from '../user/entities/user.entity';
import { BizModule } from '../../database/entities/biz-module.entity'; // ← 需要导入
import { SjconfigService } from '../sj-config/sj-config.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ConfigGroup,
      SjRawMaterial,
      Task,
      Result,
      User,
      BizModule,      // ← 加上这个
    ]),
  ],
  providers: [SjFixedCalcService, SjconfigService],
  controllers: [SjFixedCalcController],
})
export class SjFixedCalcModule {}
