// src/modules/sj-config/dto/sj-update-process-cost.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsObject } from 'class-validator';

export class SJUpdateProcessCostDto {
  @ApiProperty({ description: '要更新的项目名', example: '水费' })
  @IsString()
  @IsNotEmpty()
  key: string;

  @ApiProperty({ description: '更新的内容', example: { 价格: 5, 单位用量: 0.13 }})
  @IsObject()
  @IsNotEmpty()
  payload: Record<string, any>;
}
