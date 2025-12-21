import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ArrayNotEmpty, IsInt } from 'class-validator';

export class RemoveLumpMetallurgyPropDto {
  @ApiProperty({
    description: '删除 ID 列表',
    example: [1, 2, 3],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  ids: number[];
}
