// modules/price-profit-calc/price-profit-calc.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PriceProfitCalcController } from './price-profit-calc.controller';
import { PriceProfitCalcService } from './price-profit-calc.service';

import { ConfigGroup } from '../../database/entities/config-group.entity';
import { BizModule } from '../../database/entities/biz-module.entity';
import { User } from '../user/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ConfigGroup,
      BizModule,
      User, // ⭐ 关键：直接注册 User
    ]),
  ],
  controllers: [PriceProfitCalcController],
  providers: [PriceProfitCalcService],
  exports: [PriceProfitCalcService],
})
export class PriceProfitCalcModule {}
