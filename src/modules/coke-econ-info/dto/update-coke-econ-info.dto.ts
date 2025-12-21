import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsObject } from 'class-validator';

export class UpdateCokeEconInfoDto {
  @ApiPropertyOptional({
    example: '一级冶金焦',
    description: '焦炭名称',
  })
  @IsOptional()
  @IsString()
  name?: string;

  /** 化学成分及经济指标 JSON 对象 */
  @ApiPropertyOptional({
    example: {
      固定碳: 86.8,
      灰分: 12.0,
      挥发分: 1.1,
      水分: 1.6,
      S: 0.62,
      CSR: 66,
      CRI: 22,
      M10: 6.2,
      M40: 79.0,
      热值: 7250,
      价格: 2900,
    },
    description: '化学成分及经济指标 JSON 对象',
  })
  @IsOptional()
  @IsObject()
  composition?: Record<string, any>;
}
