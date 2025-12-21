import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsObject } from 'class-validator';

export class UpdateLumpEconInfoDto {
  @ApiPropertyOptional({ description: '块矿名称' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: '化学成分及经济指标（JSON）',
    example: {
      Fe: 63.1,
      SiO2: 3.9,
      价格: 800,
    },
  })
  @IsOptional()
  @IsObject()
  composition?: Record<string, any>;
}
