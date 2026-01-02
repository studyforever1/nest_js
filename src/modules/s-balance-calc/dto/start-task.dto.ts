import { IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class StartTask1Dto {
  @ApiProperty({ description: '模块名称，例如 "硫平衡计算"', example: '硫平衡计算' })
  @IsString()
  calculateType: string;
}
