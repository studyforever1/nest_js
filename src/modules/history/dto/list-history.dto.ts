// src/modules/history/dto/list-history.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ListHistoryDto {
  @ApiPropertyOptional({ description: '模块类型筛选' , example: '烧结配料计算'})
  @IsOptional()
  @IsString()
  module_type?: string;

  @ApiPropertyOptional({ description: '日期（YYYY-MM-DD），查询当天数据' })
  @IsOptional()
  @IsString()
  date?: string;

  @ApiPropertyOptional({ description: '页码', example: 1 })
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ description: '每页数量', example: 10 })
  @IsOptional()
  pageSize?: number;
}
