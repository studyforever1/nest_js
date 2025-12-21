import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { FinesHtBaseProp } from './entities/fines-ht-base-prop.entity';
import { FinesHtBasePropService } from './fines-ht-base-prop.service';
import { FinesHtBasePropController } from './fines-ht-base-prop.controller';
import { User } from '../user/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([FinesHtBaseProp, User]),
  ],
  controllers: [FinesHtBasePropController],
  providers: [FinesHtBasePropService],
  exports: [FinesHtBasePropService],
})
export class FinesHtBasePropModule {}
