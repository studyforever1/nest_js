import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ArrayNotEmpty, IsNumber } from 'class-validator';

export class SJDeleteIngredientDto {
  @ApiProperty({ description: '需要删除的原料序号数组', example: [68, 72, 75] })
  @IsArray()
  @ArrayNotEmpty()
  @IsNumber({}, { each: true })
  removeParams: number[];
}
