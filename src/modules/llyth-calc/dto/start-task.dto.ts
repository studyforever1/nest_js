import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class LLYTHStartTaskDto {
  @ApiProperty({ description: '计算任务类型，如 llyth_calc', example: '利润一体化配料计算' })
  @IsNotEmpty()
  @IsString()
  calculateType: string;
}
