import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsObject } from 'class-validator';

export class UpdateCoalEconInfoDto {
  @ApiPropertyOptional({
    example: '优质动力煤',
    description: '煤炭名称',
  })
  @IsOptional()
  @IsString()
  name?: string;

  /** 化学成分及经济指标 JSON 对象 */
  @ApiPropertyOptional({
    example: {
      挥发分: 31.0,
      灰分: 9.8,
      水分: 8.0,
      热值: 5550,
      价格: 1220,
      物料类别: '动力煤',
    },
    description: '化学成分及经济指标 JSON 对象',
  })
  @IsOptional()
  @IsObject()
  composition?: Record<string, any>;
}
