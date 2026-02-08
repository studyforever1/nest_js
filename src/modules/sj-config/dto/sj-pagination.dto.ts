import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  Min,
  Max,
  IsOptional,
  IsString,
  IsIn,
} from 'class-validator';

export class SJPaginationDto {
  @ApiPropertyOptional({ description: '页码（默认1）', example: 1 })
  @Type(() => Number)
  @IsOptional()
  @IsInt({ message: 'page 必须是整数' })
  @Min(1, { message: 'page 最小为 1' })
  page?: number;

  @ApiPropertyOptional({ description: '每页条数（默认10，最大100）', example: 10 })
  @Type(() => Number)
  @IsOptional()
  @IsInt({ message: 'pageSize 必须是整数' })
  @Min(1, { message: 'pageSize 最小为 1' })
  @Max(100, { message: 'pageSize 最大为 100' })
  pageSize?: number;

  @ApiPropertyOptional({ description: '名称模糊搜索', example: '粉' })
  @IsOptional()
  @IsString({ message: 'name 必须为字符串' })
  name?: string;

  @ApiPropertyOptional({ description: '分类 / 类型筛选', example: '矿粉' })
  @IsOptional()
  @IsString({ message: 'type 必须为字符串' })
  type?: string;

  @ApiPropertyOptional({
    description: '排序字段，如 name、inventory、composition.TFe',
    example: 'composition.TFe',
  })
  @IsOptional()
  @IsString()
  sort?: string;

  @ApiPropertyOptional({ description: '排序方式 asc/desc', example: 'asc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';
}
