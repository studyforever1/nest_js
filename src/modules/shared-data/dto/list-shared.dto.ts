import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ListSharedDto {
  @ApiPropertyOptional({ description: '模块类型筛选，可选' })
  @IsOptional()
  @IsString()
  module_type?: string;
}
