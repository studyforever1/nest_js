import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class GLStopTaskDto {
  @ApiProperty({ description: '任务 UUID，由 /gl/start 返回', example: 'uuid-1234-5678' })
  @IsNotEmpty()
  @IsString()
  task_id: string;
}
