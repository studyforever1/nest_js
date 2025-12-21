import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { LumpMetallurgyProp } from './entities/lump-metallurgy-prop.entity';
import { LumpMetallurgyPropService } from './lump-metallurgy-prop.service';
import { LumpMetallurgyPropController } from './lump-metallurgy-prop.controller';
import { User } from '../user/entities/user.entity'; // 用于记录修改者信息

@Module({
  imports: [
    TypeOrmModule.forFeature([LumpMetallurgyProp, User]), // 注册实体
  ],
  controllers: [LumpMetallurgyPropController],
  providers: [LumpMetallurgyPropService],
  exports: [LumpMetallurgyPropService],
})
export class LumpMetallurgyPropModule {}
