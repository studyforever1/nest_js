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
    TypeOrmModule.forFeature([ConfigGroup, BizModule, User, SjRawMaterial]), 
    // 🔹 注意：这里只注册 TypeORM 实体，不要在 providers 里注入其他服务
  ],
  controllers: [SjconfigController],
  providers: [SjconfigService], 
  exports: [SjconfigService], // 🔹 导出服务供其他模块注入
})
export class SjconfigModule {}