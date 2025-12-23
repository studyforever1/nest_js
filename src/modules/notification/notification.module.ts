import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { Notification } from './entities/notification.entity';
import { User } from '../user/entities/user.entity';
import { UserModule } from '../user/user.module'; // ✅ 导入 UserModule

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, User]), // 注册实体
    UserModule, // ✅ 让 PermissionsGuard 可以注入 UserRepository
  ],
  providers: [NotificationService],
  controllers: [NotificationController],
  exports: [NotificationService],
})
export class NotificationModule {}
