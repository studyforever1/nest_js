import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

/** ======================= 启动任务 DTO ======================= */
export class StartPelletEconCalcDto {
  @ApiProperty({
    description: '计算类型（固定为外购球团经济性评价）',
    example: '外购球团经济性评价',
  })
  @IsString()
  @IsIn(['外购球团经济性评价'], { message: '计算类型必须为 "外购球团经济性评价"' })
  calculateType: string = '外购球团经济性评价';
}

/** ======================= 停止任务 DTO ======================= */
export class StopPelletEconCalcDto {
  @ApiProperty({ description: '任务 UUID', example: 'uuid1' })
  @IsString()
  taskUuid: string;
}

/** ======================= 分页查询 DTO ======================= */
export class PelletEconPaginationDto {
  @ApiPropertyOptional({ default: 1, description: '当前页' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page 必须是整数' })
  page?: number = 1;

  @ApiPropertyOptional({ default: 10, description: '每页数量' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'pageSize 必须是整数' })
  pageSize?: number = 10;

  @ApiPropertyOptional({ description: '排序字段，可传嵌套属性如 result.value' })
  @IsOptional()
  @IsString()
  sort?: string;

  @ApiPropertyOptional({ description: '排序方式，asc 或 desc', default: 'asc' })
  @IsOptional()
  @IsString()
  @IsIn(['asc', 'desc'], { message: 'order 必须是 "asc" 或 "desc"' })
  order?: 'asc' | 'desc' = 'asc';
}
