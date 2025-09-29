import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { History } from './entities/history.entity';
import { HistoryService } from './history.service';
import { HistoryController } from './history.controller';
import { User } from '../user/entities/user.entity'; // 导入 User 实体

@Module({
  imports: [
    // 同时导入 History 和 User 实体，保证 Repository 可用
    TypeOrmModule.forFeature([History, User]),
  ],
  providers: [HistoryService],
  controllers: [HistoryController],
  exports: [HistoryService], // 如果其他模块也需要使用 HistoryService
})
export class HistoryModule {}
