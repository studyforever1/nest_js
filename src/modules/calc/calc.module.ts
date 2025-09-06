import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CalcService } from './calc.service';
import { CalcController } from './calc.controller';
import { CalcTask } from './entities/task.entity';
import { Result } from './entities/result.entity';
import { User } from '../user/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CalcTask, Result, User])],
  controllers: [CalcController],
  providers: [CalcService],
})
export class CalcModule {}
