import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsObject } from 'class-validator';

export class UpdateMineTypIndDto {
  @ApiPropertyOptional({ description: '矿山名称' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: '主要矿山典型指标（composition，JSON 对象）' })
  @IsOptional()
  @IsObject()
  composition?: Record<string, any>;
}
