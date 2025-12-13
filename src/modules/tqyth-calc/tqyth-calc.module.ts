import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TqythCalcService } from './tqyth-calc.service';
import { TqythCalcController } from './tqyth-calc.controller';
import { Task } from '../../database/entities/task.entity';
import { Result } from '../../database/entities/result.entity';
import { User } from '../user/entities/user.entity';
import { GlMaterialInfo } from '../gl-material-info/entities/gl-material-info.entity';
import { GlFuelInfo } from '../gl-fuel-info/entities/gl-fuel-info.entity';
import { SjCandidate } from '../sj-candidate/entities/sj-candidate.entity'; // ✅ 导入实体
import { GlConfigModule } from '../gl-config/gl-config.module'; 

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Task,
      Result,
      User,
      GlMaterialInfo,
      GlFuelInfo,
      SjCandidate, // ✅ 添加这一行
    ]),
    GlConfigModule,
  ],
  controllers: [TqythCalcController],
  providers: [TqythCalcService],
})
export class TqythCalcModule {}
