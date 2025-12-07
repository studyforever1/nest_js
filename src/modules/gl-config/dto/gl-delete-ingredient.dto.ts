// dto/gl-delete-ingredient.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsArray } from 'class-validator';

export class GLDeleteIngredientDto {
  @ApiProperty({ description: '删除的原料ID列表',example: []})
  @IsArray()
  removeParams: number[];
}
