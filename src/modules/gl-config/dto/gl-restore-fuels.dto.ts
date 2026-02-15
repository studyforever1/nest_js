// dto/gl-restore-fuels.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsInt } from 'class-validator';

export class GLRestoreFuelsDto {
  @ApiProperty({
    description: '要恢复的燃料ID数组，如果为空则全部恢复',
    example: [1, 2, 3],
  })
  @IsArray()
  @IsInt({ each: true })
  ids: number[];
}