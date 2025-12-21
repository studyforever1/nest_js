import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Min, Max, IsOptional, IsString } from 'class-validator';

export class PaginationDto {
  @ApiPropertyOptional({ description: '页码（默认1）', example: 1 })
  @Type(() => Number)
  @IsInt({ message: 'page 必须是整数' })
  @Min(1, { message: 'page 最小为 1' })
  page: number = 1;

  @ApiPropertyOptional({ description: '每页条数（默认10，最大100）', example: 10 })
  @Type(() => Number)
  @IsInt({ message: 'pageSize 必须是整数' })
  @Min(1, { message: 'pageSize 最小为 1' })
  @Max(100, { message: 'pageSize 最大为 100' })
  pageSize: number = 10;

  @ApiPropertyOptional({ description: '名称模糊搜索', example: '球团' })
  @IsOptional()
  @IsString()
  name?: string;
}
