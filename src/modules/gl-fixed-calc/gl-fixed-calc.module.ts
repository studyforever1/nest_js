import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GlFixedCalcService } from './gl-fixed-calc.service';
import { GlFixedCalcController } from './gl-fixed-calc.controller';
import { Task } from '../../database/entities/task.entity';
import { Result } from '../../database/entities/result.entity';
import { User } from '../user/entities/user.entity';
import { GlMaterialInfo } from '../gl-material-info/entities/gl-material-info.entity';
import { GlFuelInfo } from '../gl-fuel-info/entities/gl-fuel-info.entity'; // ✅ 新增燃料表
import { GlConfigModule } from '../gl-config/gl-config.module'; // ✅ 导入包含 GlConfigService 的模块

@Module({
  imports: [
    TypeOrmModule.forFeature([Task, Result, User, GlMaterialInfo, GlFuelInfo]), // ✅ 加入燃料表
    GlConfigModule, // ✅ 导入模块，而不是服务
  ],
  controllers: [GlFixedCalcController],
  providers: [GlFixedCalcService],
})
export class GlFixedCalcModule {}
