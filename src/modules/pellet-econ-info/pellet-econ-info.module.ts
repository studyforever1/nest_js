import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PelletEconInfo } from './entities/pellet-econ-info.entity';
import { PelletEconInfoService } from './pellet-econ-info.service';
import { PelletEconInfoController } from './pellet-econ-info.controller';
import { User } from '../user/entities/user.entity'; // 如果涉及修改者信息，可引入 User

@Module({
  imports: [
    TypeOrmModule.forFeature([PelletEconInfo, User]), // 注册实体
  ],
  controllers: [PelletEconInfoController],
  providers: [PelletEconInfoService],
  exports: [PelletEconInfoService],
})
export class PelletEconInfoModule {}
