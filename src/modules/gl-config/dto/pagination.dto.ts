import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Min, Max, IsOptional, IsString, IsIn } from 'class-validator';

export class PaginationDto {
  @ApiPropertyOptional({ description: '页码（默认1）', example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ description: '每页条数（默认10，最大100）', example: 10 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 10;

  @ApiPropertyOptional({ description: '名称模糊搜索', example: '粉' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: '类型筛选: ingredient/fuel', example: 'ingredient' })
  @IsOptional()
  @IsString()
  @IsIn(['ingredient', 'fuel', ''], { message: 'type 必须为 ingredient/fuel 或空' })
  type?: 'ingredient' | 'fuel' | '';
}
