import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ArrayNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class DeleteIngredientDto {
  @ApiProperty({
    description: '需要删除的原料/燃料ID列表',
    example: [68, 72, 75],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsNumber({}, { each: true })
  removeParams: number[];   // **注意：字段名改为 removeParams，与 controller 保持一致 */

  @ApiProperty({
    description: '类型: ingredient/fuel，可选',
    required: false,
  })
  @IsOptional()
  @IsString()
  type?: 'ingredient' | 'fuel';
}
