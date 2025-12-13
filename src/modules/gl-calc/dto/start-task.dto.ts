import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class GLStartTaskDto {
  @ApiProperty({ description: '计算任务类型，如 gl_cost_optimize', example: '铁前一体化配料计算I' })
  @IsNotEmpty()
  @IsString()
  calculateType: string;
}
