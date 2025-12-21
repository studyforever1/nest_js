import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsObject } from 'class-validator';

export class UpdatePelletEconInfoDto {
  @ApiPropertyOptional({
    example: '一级球团',
    description: '球团名称',
  })
  @IsOptional()
  @IsString()
  name?: string;

  /** 化学成分及经济指标 JSON 对象 */
  @ApiPropertyOptional({
    example: {
      Fe: 65.2,
      SiO2: 3.0,
      Al2O3: 1.0,
      CaO: 2.1,
      MgO: 0.4,
      价格: 1520,
      热值: 6550,
    },
    description: '化学成分及经济指标 JSON 对象',
  })
  @IsOptional()
  @IsObject()
  composition?: Record<string, any>;
}
