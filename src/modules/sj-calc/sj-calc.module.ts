import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CalcService } from './sj-calc.service';
import { CalcController } from './sj-calc.controller';
import { Task } from '../../database/entities/task.entity';
import { Result } from './entities/result.entity';
import { User } from '../user/entities/user.entity';
import { SjRawMaterial } from '../sj-raw-material/entities/sj-raw-material.entity';
import { History } from '../history/entities/history.entity'; // 导入 History 实体
import { SjconfigModule } from '../sj-config/sj-config.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Task, Result, User, SjRawMaterial, History]), // 添加 History
    SjconfigModule
  ],
  controllers: [CalcController],
  providers: [CalcService],
})
export class CalcModule {}
