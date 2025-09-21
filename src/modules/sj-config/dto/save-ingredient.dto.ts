import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ArrayNotEmpty, IsNumber } from 'class-validator';

export class SaveIngredientDto {
  @ApiProperty({ example: [1, 2] })
  @IsArray()
  @ArrayNotEmpty()
  @IsNumber({}, { each: true })
  ingredientParams: number[];
}
