import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsObject } from 'class-validator';

export class CreateMineTypIndDto {
  @ApiProperty({ description: '矿山名称' })
  @IsString()
  name: string;

  @ApiProperty({
    description: '主要矿山典型指标（JSON）',
    required: false,
    example: { Fe: 65, Al2O3: 2.5, SiO2: 4.0, 矿石类型: '块矿' },
  })
  @IsOptional()
  @IsObject()
  indicators?: Record<string, any>;
}
