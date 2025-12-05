import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class StartTaskDto {
  @ApiProperty({ description: '计算任务类型，如 gl_cost_optimize', example: 'gl_cost_optimize' })
  @IsNotEmpty()
  @IsString()
  calculateType: string;
}
