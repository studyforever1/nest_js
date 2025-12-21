import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsObject } from 'class-validator';

export class UpdateFinesHtBasePropDto {
  @ApiPropertyOptional({ description: '铁矿粉名称' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: '高温基础特性（JSON）',
  })
  @IsOptional()
  @IsObject()
  properties?: Record<string, any>;
}
