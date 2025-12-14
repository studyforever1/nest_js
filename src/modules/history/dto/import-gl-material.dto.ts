// src/modules/history/dto/import-gl-material.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ArrayNotEmpty, IsInt } from 'class-validator';

export class ImportGlMaterialDto {
  @ApiProperty({
    description: '历史记录 ID 列表',
    type: [Number],
    example: [1, 2, 3],
  })
  @IsArray({ message: 'historyIds 必须是数组' })
  @IsInt({ each: true, message: 'historyIds 数组中的元素必须是整数' })
  Ids: number[];
}
