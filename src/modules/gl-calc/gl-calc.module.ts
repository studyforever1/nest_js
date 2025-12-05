import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GlCalcService } from './gl-calc.service';
import { GlCalcController } from './gl-calc.controller';
import { Task } from '../../database/entities/task.entity';
import { Result } from '../../database/entities/result.entity';
import { User } from '../user/entities/user.entity';
import { GlMaterialInfo } from '../gl-material-info/entities/gl-material-info.entity';
import { SjconfigModule } from '../sj-config/sj-config.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Task, Result, User, GlMaterialInfo]),
    SjconfigModule,
  ],
  controllers: [GlCalcController],
  providers: [GlCalcService],
})
export class GlCalcModule {}
