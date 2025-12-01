import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GlMaterialInfo } from './entities/gl-material-info.entity';
import { GlMaterialInfoService } from './gl-material-info.service';
import { GlMaterialInfoController } from './gl-material-info.controller';
import { User } from '../user/entities/user.entity'; // 引入 User

@Module({
  imports: [
    TypeOrmModule.forFeature([GlMaterialInfo, User]), // ✅ 添加 User
  ],
  controllers: [GlMaterialInfoController],
  providers: [GlMaterialInfoService],
  exports: [GlMaterialInfoService],
})
export class GlMaterialInfoModule {}
