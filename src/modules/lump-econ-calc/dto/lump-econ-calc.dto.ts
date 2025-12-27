import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, IsIn, IsString } from 'class-validator';
import { Type } from 'class-transformer';

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
// dto/lump-econ-calc.dto.ts（或 coal-econ-calc.dto.ts）
export class LumpEconPaginationDto {
  @ApiPropertyOptional({
    description: '页码',
    default: 1,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: '每页条数',
    default: 10,
    example: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number = 10;

  @ApiPropertyOptional({
    description: '排序字段（结果中的字段名）',
    example: '单品价格',
  })
  @IsOptional()
  @IsString()
  sort?: string;

  @ApiPropertyOptional({
    description: '排序方式',
    enum: ['asc', 'desc'],
    default: 'desc',
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc' = 'asc';
}
