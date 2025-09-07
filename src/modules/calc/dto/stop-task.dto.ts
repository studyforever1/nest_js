// src/calc/dto/stop-task.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class StopTaskDto {
  @ApiProperty({ description: '任务ID' })
  @IsString()
  task_id: string;
}
