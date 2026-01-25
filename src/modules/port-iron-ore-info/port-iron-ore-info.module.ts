import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PortIronOreInfo } from './entities/port-iron-ore-info.entity';
import { PortIronOreInfoService } from './port-iron-ore-info.service';
import { PortIronOreInfoController } from './port-iron-ore-info.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PortIronOreInfo])],
  controllers: [PortIronOreInfoController],
  providers: [PortIronOreInfoService],
})
export class PortIronOreInfoModule {}
