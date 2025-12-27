// src/modules/sj-config/dto/sj-add-process-cost.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsObject } from 'class-validator';

export class SJAddProcessCostDto {
  @ApiProperty({ description: '新增工序成本项', example: {
    水费: { 价格: 4, 单位: 'T', 单位用量: 0.12, 项目分类: '动力费用' },
    电费: { 价格: 0.49, 单位: 'KWH', 单位用量: 39.2, 项目分类: '动力费用' },
  }})
  @IsObject()
  @IsNotEmpty()
  items: Record<string, any>;
}
