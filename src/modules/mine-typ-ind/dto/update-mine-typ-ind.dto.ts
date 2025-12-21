import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsObject } from 'class-validator';

export class UpdateMineTypIndDto {
  @ApiPropertyOptional({ description: '矿山名称' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: '主要矿山典型指标（JSON）' })
  @IsOptional()
  @IsObject()
  indicators?: Record<string, any>;
}
