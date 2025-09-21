import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CalcService } from './sj-calc.service';
import { CalcController } from './sj-calc.controller';
import { Task } from '../../database/entities/task.entity';
import { Result } from './entities/result.entity';
import { User } from '../user/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Task, Result, User])],
  controllers: [CalcController],
  providers: [CalcService],
})
export class CalcModule {}
