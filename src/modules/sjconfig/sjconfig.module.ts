// modules/sjconfig/sjconfig.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SjconfigService } from './sjconfig.service';
import { SjconfigController } from './sjconfig.controller';
import { ConfigGroup } from '../../database/entities/config-group.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ConfigGroup])],
  providers: [SjconfigService],
  controllers: [SjconfigController],
  exports: [SjconfigService],
})
export class SjconfigModule {}
