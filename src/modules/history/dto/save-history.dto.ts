// src/modules/history/dto/save-history.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsArray, ArrayMinSize, IsInt, Min } from 'class-validator';

export class SaveHistoryDto {
  @ApiProperty({ example: 'task-uuid-123', description: '任务 UUID' })
  @IsString()
  taskUuid: string;

  @ApiProperty({
    example: [0, 1, 2],
    description: '用户选择的方案序号数组（批量保存）',
  })
  @IsArray()
  @ArrayMinSize(1, { message: '至少选择一个方案序号' })
  @IsInt({ each: true, message: '数组中的每个值都必须是整数' })
  @Min(0, { each: true, message: '序号不能小于 0' })
  schemeIndexes: number[];

  @ApiProperty({ example: '烧结配料计算', description: '模块类型' })
  @IsString()
  module_type: string;
}
