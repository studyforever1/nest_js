import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SjCandidateService } from './sj-candidate.service';
import { SjCandidateController } from './sj-candidate.controller';
import { SjCandidate } from './entities/sj-candidate.entity';
import { Task } from '../../database/entities/task.entity';
import { User } from '../user/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([SjCandidate, Task, User]), // 注入实体
  ],
  controllers: [SjCandidateController],
  providers: [SjCandidateService],
  exports: [SjCandidateService], // 如果其他模块也要调用
})
export class SjCandidateModule {}
