// src/calc/dto/get-scheme.dto.ts
import { IsString, IsNotEmpty, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class LLYTHGetSchemeDto {
  @ApiProperty({ description: '任务 UUID', example: '40d96bf3-c8d9-4564-9b83-3b33b98de65b' })
  @IsString()
  @IsNotEmpty()
  taskUuid: string;

  @ApiProperty({ description: '方案序号，从0开始', example: 0 })
  @Type(() => Number) // 🔑 自动转换
  @IsInt()
  index: number;
}
