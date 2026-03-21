import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ConfigGroup } from '../../database/entities/config-group.entity';
import { BizModule } from '../../database/entities/biz-module.entity';
import { User } from '../user/entities/user.entity';
import { CommonController } from './common.controller';
import { CommonService } from './common.service';



@Module({
  imports: [
    TypeOrmModule.forFeature([
      ConfigGroup,
      BizModule,
      User,
    ]),
  ],
  controllers: [CommonController],
  providers: [CommonService], // ⭐ 必须加
  exports: [CommonService],   // ⭐ 如果别的模块要用
})
export class CommonModule {}