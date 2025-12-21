import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsObject } from 'class-validator';

export class CreateLumpMetallurgyPropDto {
  @ApiProperty({ description: '块矿名称' })
  @IsString()
  name: string;

  @ApiProperty({
    description: '块矿冶金性能（JSON）',
    required: false,
    example: {
      '碱度4_0液相流动性指数/1250度': 68.5,
      '碱度4_0液相流动性指数/1270度': 72.3,
      '碱度2_0粘结相强度': 89,
    },
  })
  @IsOptional()
  @IsObject()
  properties?: Record<string, any>;
}
