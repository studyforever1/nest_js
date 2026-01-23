// src/sj-econ-calc/dto/econ-task-ref.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID } from 'class-validator';

export class EconTaskRefDto {
  @ApiProperty({
    description: '任务 UUID',
    example: 'ff66b09f-f61a-4344-8ed4-923bed7d2f56',
  })
  @IsUUID()
  taskUuid: string;

  @ApiProperty({
    description: '评价方法名称',
    example: '品位综合评价法',
  })
  @IsString()
  name: string;
}
