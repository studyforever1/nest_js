// src/sj-econ-calc/dto/start-econ-calc.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class StartEconCalcDto {
  @ApiProperty({ description: '计算类型（模块名，如 烧结计算模块', example: '烧结原料经济性评价' })
  @IsString()
  calculateType: string;
}
