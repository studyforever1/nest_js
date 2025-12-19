// dto/sj-econ-config.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsNumber, IsOptional, IsObject, IsString } from 'class-validator';
import { Type } from 'class-transformer';
/** 保存完整参数组 DTO */
export class SaveSjEconConfigDto {
  @ApiProperty({ description: '完整经济指标参数 JSON 对象' })
  @IsObject()
  config_data: Record<string, any>;
}

/** 保存选中原料 DTO */
export class SaveSjEconIngredientsDto {
  @ApiProperty({ description: '选中原料 ID 数组', type: [Number] })
  @IsArray()
  @IsNumber({}, { each: true })
  selectedIds: number[];

  @ApiPropertyOptional({ description: '模糊查找名称（可选）' })
  @IsOptional()
  @IsString()
  name?: string;
}

/** 删除选中原料 DTO */
export class DeleteSjEconIngredientsDto {
  @ApiProperty({ description: '要删除的原料 ID 数组', type: [Number] })
  @IsArray()
  @IsNumber({}, { each: true })
  removeIds: number[];
}

/** 分页查询 DTO */
export class SjEconPaginationDto {
  @ApiPropertyOptional({ description: '页码', default: 1 })
  @IsOptional()
  @Type(() => Number)    // 转换为数字
  @IsNumber()
  page?: number;

  @ApiPropertyOptional({ description: '每页数量', default: 10 })
  @IsOptional()
  @Type(() => Number)    // 转换为数字
  @IsNumber()
  pageSize?: number;

  @ApiPropertyOptional({ description: '名称模糊查询' })
  @IsOptional()
  @IsString()
  name?: string;
}
