import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

/** 启动任务 */
export class StartLumpEconCalcDto {
  @ApiProperty({ description: '计算类型', example: '外购块矿经济性评价' })
  @IsString()
  calculateType: string;
}

/** 停止任务 */
export class StopLumpEconCalcDto {
  @ApiProperty({ description: '任务 UUID', example: 'uuid-xxxx' })
  @IsString()
  taskUuid: string;
}

/** 分页查询 */
export class LumpEconPaginationDto {
  @ApiPropertyOptional({ default: 1, description: '当前页' })
  @IsOptional()
  @IsString()
  page?: number;

  @ApiPropertyOptional({ default: 10, description: '每页数量' })
  @IsOptional()
  @IsString()
  pageSize?: number;
}
