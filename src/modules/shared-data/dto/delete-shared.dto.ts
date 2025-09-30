import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ArrayNotEmpty, IsString, IsNumber, IsOptional } from 'class-validator';

export class DeleteSharedDto {
  @ApiProperty({ description: '要删除的共享方案ID列表', type: [Number] })
  @IsArray()
  @ArrayNotEmpty()
  ids: number[] | string[];
}
