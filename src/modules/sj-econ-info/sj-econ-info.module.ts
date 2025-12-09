import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SjEconInfo } from './entities/sj-econ-info.entity';
import { SjEconInfoService } from './sj-econ-info.service';
import { SjEconInfoController } from './sj-econ-info.controller';
import { User } from '../user/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([SjEconInfo, User]),
  ],
  controllers: [SjEconInfoController],
  providers: [SjEconInfoService],
  exports: [SjEconInfoService],
})
export class SjEconInfoModule {}

