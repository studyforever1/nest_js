import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsObject } from 'class-validator';

export class SJSaveConfigDto {
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

  @ApiProperty({
    required: false,
    example: {
        "其它": {
          "价格": "--",
          "单位": "元",
          "单位成本": 22.15,
          "单位用量": "--",
          "项目分类": "制造费用"
        },
        "氧气": {
          "价格": 0.18,
          "单位": "M3",
          "单位成本": "--",
          "单位用量": 1.2141,
          "项目分类": "动力费用"
        }},
  })
  @IsOptional()
  @IsObject()
  SJProcessCost?: Record<string, any>;
}
