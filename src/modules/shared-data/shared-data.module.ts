import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SharedDataService } from './shared-data.service';
import { SharedDataController } from './shared-data.controller';
import { SharedData } from './entities/shared-data.entity';
import { Task } from '../../database/entities/task.entity';
import { User } from '../user/entities/user.entity';
import { GlMaterialInfo } from '../gl-material-info/entities/gl-material-info.entity'; // ✅ 引入

@Module({
  imports: [
    TypeOrmModule.forFeature([SharedData, Task, User, GlMaterialInfo]) // ✅ 添加 GlMaterialInfo
  ],
  controllers: [SharedDataController],
  providers: [SharedDataService],
  exports: [SharedDataService],
})
export class SharedDataModule {}
