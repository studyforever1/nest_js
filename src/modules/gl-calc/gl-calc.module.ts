import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GlCalcService } from './gl-calc.service';
import { GlCalcController } from './gl-calc.controller';
import { Task } from '../../database/entities/task.entity';
import { Result } from '../../database/entities/result.entity';
import { User } from '../user/entities/user.entity';
import { GlMaterialInfo } from '../gl-material-info/entities/gl-material-info.entity';
import { GlFuelInfo } from '../gl-fuel-info/entities/gl-fuel-info.entity';
import { GlConfigModule } from '../gl-config/gl-config.module'; // ✅ 导入模块

@Module({
  imports: [
    TypeOrmModule.forFeature([Task, Result, User, GlMaterialInfo, GlFuelInfo]),
    GlConfigModule, // ✅ 导入模块，而不是服务
  ],
  controllers: [GlCalcController],
  providers: [GlCalcService],
})
export class GlCalcModule {}
