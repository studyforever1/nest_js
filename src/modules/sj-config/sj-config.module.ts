// modules/sjconfig/sjconfig.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SjconfigController } from './sj-config.controller';
import { SjconfigService } from './sj-config.service';
import { ConfigGroup } from '../../database/entities/config-group.entity';
import { BizModule } from '../../database/entities/biz-module.entity';
import { User } from '../user/entities/user.entity';
import { SjRawMaterial } from '../sj-raw-material/entities/sj-raw-material.entity';


@Module({
  imports: [
    TypeOrmModule.forFeature([ConfigGroup, BizModule,User,SjRawMaterial]), // 必须同时注册 BizModule
  ],
  controllers: [SjconfigController],
  providers: [SjconfigService],
  exports: [SjconfigService], // 导出服务以供其他模块使用
})
export class SjconfigModule {}
