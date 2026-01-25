import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PortPelletLumpInfoController } from './port-pellet-lump-info.controller';
import { PortPelletLumpInfoService } from './port-pellet-lump-info.service';
import { PortPelletLumpInfo } from './entities/port-pellet-lump-info.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([PortPelletLumpInfo]),
  ],
  controllers: [
    PortPelletLumpInfoController,
  ],
  providers: [
    PortPelletLumpInfoService,
  ],
  exports: [
    PortPelletLumpInfoService,
  ],
})
export class PortPelletLumpInfoModule {}
