import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CoalEconInfo } from './entities/coal-econ-info.entity';
import { CoalEconInfoService } from './coal-econ-info.service';
import { CoalEconInfoController } from './coal-econ-info.controller';
import { User } from '../user/entities/user.entity'; // 如果需要关联用户

@Module({
  imports: [
    TypeOrmModule.forFeature([CoalEconInfo, User]), // 注册实体
  ],
  controllers: [CoalEconInfoController],
  providers: [CoalEconInfoService],
  exports: [CoalEconInfoService],
})
export class CoalEconInfoModule {}
