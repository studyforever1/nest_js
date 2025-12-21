import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CokeEconInfo } from './entities/coke-econ-info.entity';
import { CokeEconInfoService } from './coke-econ-info.service';
import { CokeEconInfoController } from './coke-econ-info.controller';
import { User } from '../user/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([CokeEconInfo, User]),
  ],
  controllers: [CokeEconInfoController],
  providers: [CokeEconInfoService],
  exports: [CokeEconInfoService],
})
export class CokeEconInfoModule {}
