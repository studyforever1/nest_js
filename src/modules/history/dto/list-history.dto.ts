import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ListHistoryDto {
  @ApiPropertyOptional({ description: '模块类型，可选筛选' })
  module_type?: string;
}
