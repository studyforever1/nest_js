import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { Notification } from './entities/notification.entity';
import { NotificationUser } from './entities/notification-user.entity';
import { User } from '../user/entities/user.entity';
import { UserModule } from '../user/user.module'; // ✅ 导入 UserModule
import { NotificationGateway } from './notification.gateway';
import { PresenceService } from './presence.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, User,NotificationUser]), // 注册实体
    UserModule, // ✅ 让 PermissionsGuard 可以注入 UserRepository
  ],
  providers: [NotificationService, NotificationGateway, PresenceService],
  controllers: [NotificationController],
  exports: [NotificationService, NotificationGateway, PresenceService],
})
export class NotificationModule {}
