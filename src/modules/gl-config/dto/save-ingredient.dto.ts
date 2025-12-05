import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsArray, IsNumber, IsString } from 'class-validator';

export class SaveIngredientDto {
  @ApiProperty({
    example: [1, 2],
    description: '选中的原料/燃料ID列表，可为空',
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  ingredientParams?: number[]; // 与 controller 保持一致

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
    description: '名称模糊匹配，可选（分类同步模式使用）',
    required: false,
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({
    example: 'ingredient',
    description: '类型: ingredient/ fuel',
    required: false,
  })
  @IsOptional()
  @IsString()
  type?: 'ingredient' | 'fuel';
}
