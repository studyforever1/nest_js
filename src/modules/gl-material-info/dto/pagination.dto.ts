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

export class GLPaginationDto {
  @ApiPropertyOptional({ description: '页码（默认1）' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ description: '每页条数（默认10，最大100）' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 10;

  @ApiPropertyOptional({ description: '名称模糊查询' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: '类型 / 分类筛选' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({
    description: '排序字段，如 name、createdAt、inventory',
    example: 'composition.TFe',
  })
  @IsOptional()
  @IsString()
  sort?: string;

  @ApiPropertyOptional({
    description: '排序方式 asc / desc',
    example: 'asc',
    enum: ['asc', 'desc'],
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';
}
