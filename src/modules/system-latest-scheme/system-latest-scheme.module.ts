import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SystemLatestScheme } from './entities/system-latest-scheme.entity';
import { SystemLatestSchemeService } from './system-latest-scheme.service';
import { SystemLatestSchemeController } from './system-latest-scheme.controller';
import { Task } from '../../database/entities/task.entity';
import { User } from '../user/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([SystemLatestScheme, Task, User]),
  ],
  providers: [SystemLatestSchemeService],
  controllers: [SystemLatestSchemeController],
  exports: [SystemLatestSchemeService],
})
export class SystemLatestSchemeModule {}
