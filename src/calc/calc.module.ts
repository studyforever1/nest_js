import { Module } from '@nestjs/common';
import { CalcService } from './calc.service';
import { CalcController } from './calc.controller';

@Module({
  controllers: [CalcController],
  providers: [CalcService],
})
export class CalcModule {}
