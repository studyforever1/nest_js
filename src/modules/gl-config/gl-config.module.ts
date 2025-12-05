import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GlConfigService } from './gl-config.service';
import { GlConfigController } from './gl-config.controller';
import { ConfigGroup } from '../../database/entities/config-group.entity';
import { BizModule } from '../../database/entities/biz-module.entity';
import { User } from '../user/entities/user.entity'; // User 实体
import { UserModule } from '../user/user.module'; // User 模块

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ConfigGroup,
      BizModule,
      User, // 注册 User Repository
    ]),
    UserModule, // 导入 UserModule，确保 PermissionsGuard 能获取 UserRepository
  ],
  providers: [GlConfigService],
  controllers: [GlConfigController],
  exports: [GlConfigService],
})
export class GlConfigModule {}
