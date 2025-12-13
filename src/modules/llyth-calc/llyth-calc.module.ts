import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LlythCalcService } from './llyth-calc.service';
import { LlythCalcController } from './llyth-calc.controller';
import { Task } from '../../database/entities/task.entity';
import { Result } from '../../database/entities/result.entity';
import { User } from '../user/entities/user.entity';
import { GlMaterialInfo } from '../gl-material-info/entities/gl-material-info.entity';
import { GlFuelInfo } from '../gl-fuel-info/entities/gl-fuel-info.entity';
import { SjCandidate } from '../sj-candidate/entities/sj-candidate.entity';
import { GlConfigModule } from '../gl-config/gl-config.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Task,
      Result,
      User,
      GlMaterialInfo,
      GlFuelInfo,
      SjCandidate, // ✅ 添加实体
    ]),
    GlConfigModule, // ✅ 引入配置模块
  ],
  controllers: [LlythCalcController],
  providers: [LlythCalcService],
})
export class LlythCalcModule {}
