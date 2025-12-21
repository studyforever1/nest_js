import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsObject } from 'class-validator';

export class CreateLumpEconInfoDto {
  @ApiProperty({ description: '块矿名称' })
  @IsString()
  name: string;

  @ApiProperty({
    description: '化学成分及经济指标（JSON）',
    required: false,
    example: {
      物料类别: '块矿',
      Fe: 62.5,
      SiO2: 4.2,
      Al2O3: 1.8,
      价格: 780,
    },
  })
  @IsOptional()
  @IsObject()
  composition?: Record<string, any>;
}
