import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsArray, ArrayMinSize, IsInt, Min } from 'class-validator';

export class SaveCandidateDto {
  @ApiProperty({ example: 'task-uuid-123', description: '任务 UUID' })
  @IsString()
  taskUuid: string;

  @ApiProperty({
    example: [0, 1],
    description: '用户选择的方案序号数组（批量保存）',
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  @Min(0, { each: true })
  schemeIndexes: number[];

  @ApiProperty({ example: '烧结配料计算', description: '模块类型' })
  @IsString()
  module_type: string;
}
