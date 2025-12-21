import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, ArrayNotEmpty, IsInt, IsOptional, IsObject } from 'class-validator';

/** 保存完整球团经济性参数 */
export class SavePelletEconConfigDto {
  @ApiProperty({ description: '完整参数组', example: {} })
  @IsObject()
  config_data: Record<string, any>;
}

/** 保存选中球团 ID 或模糊筛选 */
export class SavePelletParamsDto {
  @ApiPropertyOptional({ description: '选中球团 ID 列表', example: [1, 2, 3] })
  @IsArray()
  @IsOptional()
  @IsInt({ each: true })
  selectedIds?: number[];

  @ApiPropertyOptional({ description: '球团名称模糊筛选', example: '球团A' })
  @IsOptional()
  name?: string;
}

/** 删除选中球团 */
export class DeletePelletParamsDto {
  @ApiProperty({ description: '删除 ID 列表', example: [1, 2] })
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  removeIds: number[];
}

/** 分页查询 DTO */
export class PelletEconPaginationDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  pageSize?: number;

  @ApiPropertyOptional({ description: '球团名称模糊搜索' })
  @IsOptional()
  name?: string;
}
