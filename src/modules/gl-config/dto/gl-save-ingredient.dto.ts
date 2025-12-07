// dto/gl-save-ingredient.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString } from 'class-validator';

export class GLSaveIngredientDto {
  @ApiProperty({ description: '原料ID列表' ,example: [1, 2],})
  @IsArray()
  ingredientParams: number[];

  @ApiPropertyOptional({ description: '分类编号' ,example: ""})
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: '原料名称' ,example: ""})
  @IsOptional()
  @IsString()
  name?: string;
}