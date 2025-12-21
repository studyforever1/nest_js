import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class StartCoalEconCalcDto {
  @ApiProperty({ description: '计算类型', example: '喷吹煤经济性评价' })
  @IsString()
  calculateType: string;
}

export class StopCoalEconCalcDto {
  @ApiProperty({ description: '任务 UUID' })
  @IsString()
  taskUuid: string;
}

export class CoalEconPaginationDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  pageSize?: number;
}
