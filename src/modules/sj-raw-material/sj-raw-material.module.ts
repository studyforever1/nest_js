// modules/sj-raw-material/sj-raw-material.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SjRawMaterial } from './entities/sj-raw-material.entity';
import { SjRawMaterialService } from './sj-raw-material.service';
import { SjRawMaterialController } from './sj-raw-material.controller';
import { User } from '../user/entities/user.entity';


@Module({
  imports: [
    TypeOrmModule.forFeature([SjRawMaterial, User]),
  ],
  controllers: [SjRawMaterialController],
  providers: [SjRawMaterialService], // 不直接写 SjconfigService
  exports: [SjRawMaterialService],
})
export class SjRawMaterialModule {}