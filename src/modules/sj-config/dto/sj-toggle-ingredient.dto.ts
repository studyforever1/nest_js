import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNumber } from 'class-validator';

export class SJToggleIngredientDto {
  @ApiProperty({
    example: 1,
    description: '原料ID',
  })
  @IsNumber()
  id: number;

  @ApiProperty({
    example: true,
    description: '是否选中（true: 选中 / false: 取消）',
  })
  @IsBoolean()
  checked: boolean;
}