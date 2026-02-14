// modules/sj-raw-material/sj-raw-material.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SjRawMaterial } from './entities/sj-raw-material.entity';
import { SjRawMaterialService } from './sj-raw-material.service';
import { SjRawMaterialController } from './sj-raw-material.controller';
import { User } from '../user/entities/user.entity';
import { SjconfigModule } from '../sj-config/sj-config.module'; // ✅ 导入模块

@Module({
  imports: [
    TypeOrmModule.forFeature([SjRawMaterial, User]),
    SjconfigModule, // 🔹 关键：导入 SjconfigModule
  ],
  controllers: [SjRawMaterialController],
  providers: [SjRawMaterialService], // 不直接写 SjconfigService
  exports: [SjRawMaterialService],
})
export class SjRawMaterialModule {}