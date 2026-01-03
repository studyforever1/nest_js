import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class StartTask2Dto {
  @ApiProperty({ description: '模块名称，例如 "烧结固定配料计算"', example: '烧结固定配料计算' })
  @IsString()
  calculateType: string;
}