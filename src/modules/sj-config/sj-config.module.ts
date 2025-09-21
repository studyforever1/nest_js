// modules/sjconfig/sjconfig.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SjconfigController } from './sj-config.controller';
import { SjconfigService } from './sj-config.service';
import { ConfigGroup } from '../../database/entities/config-group.entity';
import { BizModule } from '../../database/entities/biz-module.entity';
import { User } from '../user/entities/user.entity';


@Module({
  imports: [
    TypeOrmModule.forFeature([ConfigGroup, BizModule,User]), // 必须同时注册 BizModule
  ],
  controllers: [SjconfigController],
  providers: [SjconfigService],
})
export class SjconfigModule {}
