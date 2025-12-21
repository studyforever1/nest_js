import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, ArrayNotEmpty, IsInt, IsOptional, IsObject } from 'class-validator';

export class SaveMixCoalConfigDto {
  @ApiProperty({ description: '完整混合煤参数组', example: {
    coalLimits: {
      "2": { low_limit: 0, top_limit: 11 },
      "3": { low_limit: 0, top_limit: 100 }
    },
    coalParams: [2, 3],
    coalCostSet: { "日总耗": 2500, "增值税率系数": 1.13, "运费税率系数": 1.09 },
    mixedCoalProperties: {
      C: { low_limit: 50, top_limit: 80 },
      S: { low_limit: 0, top_limit: 0.75 },
      灰分: { low_limit: 0, top_limit: 11 },
      挥发份: { low_limit: 16, top_limit: 25 },
      哈氏可磨: { low_limit: 65, top_limit: 80 },
      发热量_检测值: { low_limit: 5500, top_limit: 8000 }
    }
  }})
  @IsObject()
  fullConfig: Record<string, any>; // 直接接收完整对象
}

export class SaveMixCoalParamsDto {
  @ApiPropertyOptional({ description: '选中混合煤 ID 列表', example: [1,2,3] })
  @IsArray()
  @IsOptional()
  @IsInt({ each: true })
  selectedIds?: number[];
}

export class DeleteMixCoalParamsDto {
  @ApiProperty({ description: '删除 ID 列表', example: [1,2] })
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  removeIds: number[];
}

export class MixCoalPaginationDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  pageSize?: number;

  @ApiPropertyOptional({ description: '煤炭名称模糊搜索' })
  @IsOptional()
  name?: string;
}
