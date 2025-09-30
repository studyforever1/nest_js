import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsArray, ArrayNotEmpty } from 'class-validator';

export class SaveCandidateDto {
  @ApiProperty({ description: '任务 UUID' })
  @IsString()
  taskUuid: string;

  @ApiProperty({ description: '选中的方案序号数组', type: [String] })
  @IsArray()
  @ArrayNotEmpty()
  schemeIds: string[];
}
