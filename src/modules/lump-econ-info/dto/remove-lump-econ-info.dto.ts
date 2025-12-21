import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ArrayNotEmpty, IsInt } from 'class-validator';

export class RemoveLumpEconInfoDto {
  @ApiProperty({
    description: '要删除的块矿经济性信息 ID 列表',
    example: [1, 2, 3],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  ids: number[];
}
