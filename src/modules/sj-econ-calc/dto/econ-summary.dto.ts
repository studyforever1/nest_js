// src/sj-econ-calc/dto/econ-summary.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ArrayNotEmpty, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { EconTaskRefDto } from './econ-task-ref.dto';
import { SJEconPaginationDto } from './sj-econ-pagination.dto';

export class EconSummaryDto extends SJEconPaginationDto {
  @ApiProperty({
    description: '四种经济性评价任务',
    type: [EconTaskRefDto],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => EconTaskRefDto)
  taskUuids: EconTaskRefDto[];
}
