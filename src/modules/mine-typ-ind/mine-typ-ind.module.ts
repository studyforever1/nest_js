import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { MineTypInd } from './entities/mine-typ-ind.entity';
import { MineTypIndService } from './mine-typ-ind.service';
import { MineTypIndController } from './mine-typ-ind.controller';
import { User } from '../user/entities/user.entity'; // 如果需要修改者信息

@Module({
  imports: [TypeOrmModule.forFeature([MineTypInd, User])],
  controllers: [MineTypIndController],
  providers: [MineTypIndService],
  exports: [MineTypIndService],
})
export class MineTypIndModule {}
