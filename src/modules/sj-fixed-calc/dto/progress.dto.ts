import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ProgressDto {
  @ApiProperty({ description: '任务 UUID' })
  @IsString()
  taskUuid: string;
}