import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class GLStartTaskDto {
  @ApiProperty({ description: '计算任务类型，如 gl_cost_optimize', example: '单独高炉配料计算' })
  @IsNotEmpty()
  @IsString()
  calculateType: string;
}
