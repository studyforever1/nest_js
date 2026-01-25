import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ArrayNotEmpty, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class RemovePortIronOreInfoDto {
  @ApiProperty({
    description: '要删除的矿粉ID列表，可以是一个或多个',
    example: [1, 2, 3],
    type: [Number],
  })
  @IsArray()
  @ArrayNotEmpty({ message: '至少提供一个要删除的ID' })
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  ids: number[];
}
