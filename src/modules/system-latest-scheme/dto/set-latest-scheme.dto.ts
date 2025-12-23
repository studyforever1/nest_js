import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsInt, Min } from 'class-validator';

export class SetLatestSchemeDto {
  @ApiProperty({
    example: '563d4d59-eb83-4df9-ace1-62d97c5b624d',
    description: '任务 UUID',
  })
  @IsString()
  taskUuid: string;

  @ApiProperty({
    example: 0,
    description: '方案序号',
  })
  @IsInt()
  @Min(0)
  schemeIndex: number;

  @ApiProperty({
    example: '烧结配料计算',
    description: '模块类型',
  })
  @IsString()
  module_type: string;
}
