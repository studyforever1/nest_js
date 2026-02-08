import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, ArrayNotEmpty, IsInt, IsOptional, IsObject, IsString, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class SaveCoalEconConfigDto {
  @ApiProperty({ description: '完整参数组', example: {} })
  @IsObject()
  config_data: Record<string, any>;
}

export class SaveCoalParamsDto {
  @ApiPropertyOptional({ description: '选中煤炭 ID 列表', example: [1,2,3] })
  @IsArray()
  @IsOptional()
  @IsInt({ each: true })
  selectedIds?: number[];

  @ApiPropertyOptional({ description: '煤炭名称模糊筛选', example: '烟煤' })
  @IsOptional()
  name?: string;
}

export class DeleteCoalParamsDto {
  @ApiProperty({ description: '删除 ID 列表', example: [1,2] })
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  removeIds: number[];
}

export class CoalEconPaginationDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  page?: number;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  pageSize?: number;

  @ApiPropertyOptional({ description: '煤炭名称模糊搜索' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: '排序字段，如 name、composition.干基不含税到厂价',
    example: 'composition.干基不含税到厂价',
  })
  @IsOptional()
  @IsString()
  sort?: string;

  @ApiPropertyOptional({ description: '排序方式 asc/desc', example: 'asc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';
}
