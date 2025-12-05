import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsArray, ArrayNotEmpty, IsNumber } from 'class-validator';

export class ExportSchemeDto {
  @ApiProperty({ description: '任务 ID', example: 'task_xxxxx' })
  @IsString()
  @IsNotEmpty()
  taskUuid: string;

  @ApiProperty({
    description: '选中的方案序号（从 0 开始）',
    example: [0, 3, 5],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsNumber({}, { each: true })
  schemeIndexes: number[];
}
