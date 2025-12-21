import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsNumber, IsOptional, IsObject, IsString } from 'class-validator';
import { Type } from 'class-transformer';

/** 保存完整参数组 DTO */
export class SaveCokeEconConfigDto {
  @ApiProperty({
    description: '完整焦炭经济性评价参数 JSON 对象',
    example: {
      cokeParams: [],
      cokeCostSet: {
        S: 0.7,
        CRI: 30,
        CSR: 60,
        M10: 7,
        'M25/40': 92,
        水分: 6,
        灰分: 12.5,
        焦比: 380,
        含粉率: 8,
        增值税率系数: 1.13,
      },
      singleBurnSet: {
        CRI: { CRI降低: 1, 分数提高: 1.5 },
        CSR: { CSR升高: 1, 分数提高: 1.5 },
        M10: { M10降低: 0.2, 分数提高: 1 },
        M25: { M25升高: 1, 分数提高: 1 },
        灰分: { 分数提高: 6.6, 灰分降低: 1 },
        硫分: { 分数提高: 1, 硫分降低: 0.2 },
      },
    },
  })
  @IsObject()
  config_data: Record<string, any>;
}

/** 保存选中焦炭 DTO */
export class SaveCokeParamsDto {
  @ApiProperty({ description: '选中焦炭 ID 数组', type: [Number] })
  @IsArray()
  @IsNumber({}, { each: true })
  selectedIds: number[];

  @ApiPropertyOptional({ description: '焦炭名称模糊查找（可选）' })
  @IsOptional()
  @IsString()
  name?: string;
}

/** 删除选中焦炭 DTO */
export class DeleteCokeParamsDto {
  @ApiProperty({ description: '要删除的焦炭 ID 数组', type: [Number] })
  @IsArray()
  @IsNumber({}, { each: true })
  removeIds: number[];
}

/** 分页查询 DTO */
export class CokeEconPaginationDto {
  @ApiPropertyOptional({ description: '页码', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number;

  @ApiPropertyOptional({ description: '每页数量', default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  pageSize?: number;

  @ApiPropertyOptional({ description: '焦炭名称模糊查询' })
  @IsOptional()
  @IsString()
  name?: string;
}
