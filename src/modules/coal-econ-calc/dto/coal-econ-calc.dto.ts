import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString,IsInt, Min,IsIn, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

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
  @ApiPropertyOptional({
    description: '页码（从 1 开始）',
    default: 1,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    description: '每页条数',
    default: 10,
    example: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;

  @ApiPropertyOptional({
    description: '排序字段（如：综合评分 / 发热量_检测值）',
    example: '置换价值指数',
  })
  @IsOptional()
  @IsString()
  sort?: string;

  @ApiPropertyOptional({
    description: '排序方向',
    enum: ['asc', 'desc'],
    default: 'desc',
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';
}
