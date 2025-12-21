import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { LumpEconInfo } from './entities/lump-econ-info.entity';
import { LumpEconInfoService } from './lump-econ-info.service';
import { LumpEconInfoController } from './lump-econ-info.controller';
import { User } from '../user/entities/user.entity'; // 若记录修改者

@Module({
  imports: [
    TypeOrmModule.forFeature([LumpEconInfo, User]),
  ],
  controllers: [LumpEconInfoController],
  providers: [LumpEconInfoService],
  exports: [LumpEconInfoService],
})
export class LumpEconInfoModule {}
