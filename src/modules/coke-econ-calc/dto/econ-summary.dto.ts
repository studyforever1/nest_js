import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  ArrayNotEmpty,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

import { EconTaskRefDto } from './econ-task-ref.dto';
import { SJEconPaginationDto } from './coke-econ-pagination.dto';

export class EconSummaryDto extends SJEconPaginationDto {
  @ApiProperty({
    description: '参与汇总的经济性评价任务列表',
    type: [EconTaskRefDto],
    example: [
      {
        taskUuid: 'ff66b09f-f61a-4344-8ed4-923bed7d2f56',
        name: '焦炭性价比评价法',
      },
      {
        taskUuid: '1a23bcde-1111-4aaa-bbbb-999988887777',
        name: '单烧综合评价法',
      },
    ],
  })
  @IsArray()
  @ArrayNotEmpty({ message: '至少需要一个任务用于汇总' })
  @ValidateNested({ each: true })
  @Type(() => EconTaskRefDto)
  taskUuids: EconTaskRefDto[];
}
