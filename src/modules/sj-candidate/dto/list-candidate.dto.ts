import { ApiPropertyOptional } from '@nestjs/swagger';

export class ListCandidateDto {
  @ApiPropertyOptional({ description: '模块类型', example: '烧结配料计算' })
  module_type?: string;

  @ApiPropertyOptional({ description: '日期 YYYY-MM-DD' })
  date?: string;

  @ApiPropertyOptional({ description: '页码', default: 1 })
  page?: number;

  @ApiPropertyOptional({ description: '每页数量', default: 10 })
  pageSize?: number;
}
