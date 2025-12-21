import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsObject } from 'class-validator';

export class CreateFinesHtBasePropDto {
  @ApiProperty({ description: '铁矿粉名称' })
  @IsString()
  name: string;

  @ApiProperty({
    description: '高温基础特性（JSON）',
    required: false,
    example: {
      软化开始温度: 1180,
      软化终了温度: 1320,
      熔滴开始温度: 1380,
      最大压降: 6.5,
      还原度_1100: 68,
    },
  })
  @IsOptional()
  @IsObject()
  properties?: Record<string, any>;
}
