import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SharedDataService } from './shared-data.service';
import { SharedDataController } from './shared-data.controller';
import { SharedData } from './entities/shared-data.entity';
import { Task } from '../../database/entities/task.entity';
import { User } from '../user/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SharedData, Task, User])],
  controllers: [SharedDataController],
  providers: [SharedDataService],
  exports: [SharedDataService],
})
export class SharedDataModule {}
