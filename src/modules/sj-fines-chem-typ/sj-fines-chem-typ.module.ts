import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SjFinesChemTyp } from './entities/sj-fines-chem-typ.entity';
import { SjFinesChemTypService } from './sj-fines-chem-typ.service';
import { SjFinesChemTypController } from './sj-fines-chem-typ.controller';
import { User } from '../user/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SjFinesChemTyp, User])],
  controllers: [SjFinesChemTypController],
  providers: [SjFinesChemTypService],
  exports: [SjFinesChemTypService],
})
export class SjFinesChemTypModule {}
