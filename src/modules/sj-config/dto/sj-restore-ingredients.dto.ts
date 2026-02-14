import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsInt } from 'class-validator';

export class SJRestoreIngredientsDto {
  @ApiProperty({
    description: '要恢复的原料ID数组，如果为空则全部恢复',
    example: [68, 70, 72],
  })
  @IsArray()
  @IsInt({ each: true })
  ids: number[];
}