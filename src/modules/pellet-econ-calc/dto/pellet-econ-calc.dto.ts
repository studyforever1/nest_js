import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

/** 启动任务 */
export class StartPelletEconCalcDto {
  @ApiProperty({ description: '计算类型（固定为外购球团经济性评价）', example: '外购球团经济性评价' })
  @IsString()
  calculateType: string = '外购球团经济性评价';
}

/** 停止任务（单个任务 UUID） */
export class StopPelletEconCalcDto {
  @ApiProperty({ description: '任务 UUID', example: 'uuid1' })
  @IsString()
  taskUuid: string;
}

/** 分页查询 */
export class PelletEconPaginationDto {
  @ApiPropertyOptional({ default: 1, description: '当前页' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  page?: number;

  @ApiPropertyOptional({ default: 10, description: '每页数量' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  pageSize?: number;
}

