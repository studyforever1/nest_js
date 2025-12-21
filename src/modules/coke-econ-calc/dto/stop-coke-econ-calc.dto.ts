import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ArrayNotEmpty, IsString } from 'class-validator';

export class StopEconCalcDto {
  @ApiProperty({
    description: '需要停止的任务 UUID 数组',
    type: [String],
    example: ['uuid1', 'uuid2'],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  taskUuids: string[];
}
