// dto/gl-delete-fuel.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsArray } from 'class-validator';

export class GLDeleteFuelDto {
  @ApiProperty({ description: '删除的燃料ID列表',example: [] })
  @IsArray()
  removeParams: number[];
}
