// dto/export-batch.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString, ArrayNotEmpty, IsInt } from 'class-validator';

export class ExportBatchSchemeDto {
  @ApiProperty({ description: '任务 UUID' })
  @IsString()
  taskUuid: string;

  @ApiProperty({ description: '方案序号数组', example: [1, 3, 5] })
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  schemeIndexes: number[];
}
