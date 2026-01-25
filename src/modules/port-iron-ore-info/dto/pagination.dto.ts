import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  Min,
  Max,
  IsOptional,
  IsString,
  IsIn,
} from 'class-validator';

export class PortIronOrePaginationDto {
  @ApiPropertyOptional({ description: '页码（默认1）' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ description: '每页条数（默认10）' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 10;

  @ApiPropertyOptional({ description: '矿粉名称模糊查询' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: '排序字段，如 name、inventory、composition.TFe、composition.价格',
    example: 'composition.TFe',
  })
  @IsOptional()
  @IsString()
  sort?: string;

  @ApiPropertyOptional({ description: '排序方式 asc/desc', example: 'asc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';
}
