import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GlFuelInfo } from './entities/gl-fuel-info.entity';
import { GlFuelInfoService } from  './gl-fuel-info.service';
import { GlFuelInfoController } from './gl-fuel-info.controller';
import { User } from '../user/entities/user.entity'; // 引入 User

@Module({
  imports: [
    TypeOrmModule.forFeature([GlFuelInfo, User]), // ✅ 添加 User
  ],
  controllers: [GlFuelInfoController],
  providers: [GlFuelInfoService],
  exports: [GlFuelInfoService],
})
export class GlFuelInfoModule {}
