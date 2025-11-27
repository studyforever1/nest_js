import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNumber, IsOptional, IsString } from 'class-validator';

export class SaveIngredientDto {
  @ApiProperty({ 
    example: [1, 2], 
    description: '选中的原料ID列表，可为空', 
    required: false 
  })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  ingredientParams?: number[];

  @ApiProperty({ 
    example: 'T1', 
    description: '分类名称，可选', 
    required: false 
  })
  @IsOptional()
  @IsString()
  category?: string;
}
