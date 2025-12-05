import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumberString } from 'class-validator';

export class ListSharedDto {
  @ApiPropertyOptional({ description: '模块类型' , example: '烧结配料计算'})
  @IsOptional()
  @IsString()
  module_type?: string;

  @ApiPropertyOptional({ description: '日期（YYYY-MM-DD）' })
  @IsOptional()
  @IsString()
  date?: string;

  @ApiPropertyOptional({ description: '页码' })
  @IsOptional()
  @IsNumberString()
  page?: number;

  @ApiPropertyOptional({ description: '每页数量' })
  @IsOptional()
  @IsNumberString()
  pageSize?: number;
}
