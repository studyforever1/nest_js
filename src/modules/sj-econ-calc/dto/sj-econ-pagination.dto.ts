import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Min, Max, IsOptional, IsString, IsIn, IsEnum } from 'class-validator';
import { EconDataSourceType } from '../enums/econ-data-source-type.enum';

export class TaskProgressQueryDto {
  // 页码
  @ApiPropertyOptional({ description: '页码（默认1）', example: 1 })
  @Type(() => Number)
  @IsInt({ message: 'page 必须是整数' })
  @Min(1, { message: 'page 最小为 1' })
  page: number = 1;

  // 每页条数
  @ApiPropertyOptional({ description: '每页条数（默认10，最大100）', example: 10 })
  @Type(() => Number)
  @IsInt({ message: 'pageSize 必须是整数' })
  @Min(1, { message: 'pageSize 最小为 1' })
  @Max(100, { message: 'pageSize 最大为 100' })
  pageSize: number = 10;

  // 排序字段
  @ApiPropertyOptional({ description: '排序字段，例如 "主要参数.成本" 或 "化学成分.TFe"', example: '主要参数.成本' })
  @IsOptional()
  @IsString({ message: 'sort 必须是字符串' })
  sort?: string;

  // 排序方式
  @ApiPropertyOptional({ description: '排序方式 asc/desc', example: 'asc', enum: ['asc', 'desc'] })
  @IsOptional()
  @IsString({ message: 'order 必须是字符串' })
  @IsIn(['asc', 'desc'], { message: 'order 必须是 "asc" 或 "desc"' })
  order?: 'asc' | 'desc';

  // 数据来源类型
  @ApiPropertyOptional({
    description: '数据来源类型',
    enum: EconDataSourceType,
    example: EconDataSourceType.ECON
  })
  @IsEnum(EconDataSourceType, { message: 'dataSourceType 必须是 ECON | SJ_RAW | PORT_IRON' })
  dataSourceType: EconDataSourceType;
}