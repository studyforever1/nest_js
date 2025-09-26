// src/calc/dto/start-task.dto.ts
import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class StartTaskDto {
  @ApiProperty({ description: '计算类型（模块名，如 烧结计算模块' })
  @IsString()
  @IsNotEmpty()
  calculateType: string;
}
