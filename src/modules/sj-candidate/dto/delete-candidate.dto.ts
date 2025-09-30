import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ArrayNotEmpty } from 'class-validator';

export class DeleteCandidateDto {
  @ApiProperty({
    description: '要删除的候选方案ID，可单个或数组',
    type: [Number],
    example: [1, 2, 3],
  })
  @IsArray({ message: 'ids 必须是数组' })
  @ArrayNotEmpty({ message: 'ids 不能为空' })
  ids: number[] | string[];
}
