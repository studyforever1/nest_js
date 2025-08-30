import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { Task } from '../database/entities/task.entity';
import { User } from '../database/entities/user.entity';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule, // 如果在 AppModule 已经 isGlobal: true，可以省略
    TypeOrmModule.forFeature([Task, User]), // ✅ 导入 Task 和 User 实体
  ],
  providers: [TasksService],
  controllers: [TasksController],
  exports: [TasksService],
})
export class TasksModule {}
