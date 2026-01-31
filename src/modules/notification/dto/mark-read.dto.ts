// src/notification/dto/mark-read.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsBoolean, IsArray } from 'class-validator';

export class MarkReadDto {
  @ApiProperty({ description: '通知 ID 数组' })
  @IsArray()
  @IsInt({ each: true })
  ids: number[];

  @ApiProperty({ description: '是否已读' })
  @IsBoolean()
  read: boolean;
}
