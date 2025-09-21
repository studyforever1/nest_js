import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsObject } from 'class-validator';

export class SaveConfigDto {
  @ApiProperty({
    required: false,
    example: {
      '1': { low_limit: 8, top_limit: 15, lose_index: 1 },
      '2': { low_limit: 8, top_limit: 15, lose_index: 1 },
    },
  })
  @IsOptional()
  @IsObject()
  ingredientLimits?: Record<string, any>;

  @ApiProperty({
    required: false,
    example: {
      TFe: { low_limit: 51.3, top_limit: 51.3 },
      CaO2: { low_limit: 5, top_limit: 8 },
      SiO2: { low_limit: 5, top_limit: 8 },
    },
  })
  @IsOptional()
  @IsObject()
  chemicalLimits?: Record<string, any>;

  @ApiProperty({
    required: false,
    example: {
      成本间距: 1,
      S残存系数: 0.3,
      最优方案个数: 50,
    },
  })
  @IsOptional()
  @IsObject()
  otherSettings?: Record<string, any>;
}
