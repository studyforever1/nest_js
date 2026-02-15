// dto/gl-restore-ingredients.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsInt } from 'class-validator';

export class GLRestoreIngredientsDto {
  @ApiProperty({
    description: '要恢复的原料ID数组，如果为空则全部恢复',
    example: [62, 64, 68],
  })
  @IsArray()
  @IsInt({ each: true })
  ids: number[];
}