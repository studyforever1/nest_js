import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class StartEconCalcDto {
  @ApiProperty({ description: '计算类型（模块名，如 焦炭经济性评价模块）', example: '焦炭经济性评价' })
  @IsString()
  calculateType: string;
}
