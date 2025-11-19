// user/dto/user-pagination.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Min, Max, IsOptional, IsString } from 'class-validator';

export class UserPaginationDto {
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

  @ApiPropertyOptional({ description: '用户名模糊搜索', example: '张三' })
  @IsOptional()
  @IsString()
  username?: string;
}
