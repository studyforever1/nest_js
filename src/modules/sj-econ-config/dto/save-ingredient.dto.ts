import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNumber, IsOptional, IsString } from 'class-validator';

export class SaveIngredientDto {
  @ApiProperty({
    example: [1, 2],
    description: '选中的原料ID列表，可为空',
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  ingredientParams?: number[];

  @ApiProperty({
    example: 'T1',
    description: '分类名称，可选（分类同步模式使用）',
    required: false,
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({
    example: '铁',
    description: '模糊匹配原料名称，可选（分类同步模式下，用于名称搜索）',
    required: false,
  })
  @IsOptional()
  @IsString()
  name?: string;
}

