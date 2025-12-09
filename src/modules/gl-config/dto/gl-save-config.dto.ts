// dto/gl-save-config.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsObject, IsArray, IsNumber } from 'class-validator';

export class GLSaveConfigDto {
  @ApiPropertyOptional({
    description: '原料配比限制',
    example: {
      "56": { "low_limit": 2, "top_limit": 2.02 },
      "59": { "low_limit": 3, "top_limit": 6 }
    }
  })
  @IsOptional()
  @IsObject()
  ingredientLimits?: Record<string, { low_limit: number; top_limit: number }>;

  @ApiPropertyOptional({
    description: '燃料配比限制',
    example: {
      "1": { "low_limit": 0, "top_limit": 100 },
      "2": { "low_limit": 0, "top_limit": 100 }
    }
  })
  @IsOptional()
  @IsObject()
  fuelLimits?: Record<string, { low_limit: number; top_limit: number }>;

  @ApiPropertyOptional({
    description: '熔渣限制',
    example: {
      "R2": { "low_limit": 1.05, "top_limit": 1.3 },
      "MgO": { "low_limit": 0, "top_limit": 15 }
    }
  })
  @IsOptional()
  @IsObject()
  slagLimits?: Record<string, { low_limit: number; top_limit: number }>;

  @ApiPropertyOptional({
    description: '铁水比例',
    example: { "P": 1, "MnO": 0.6, "TFe": 0.997, "TiO2": 0.2 }
  })
  @IsOptional()
  @IsObject()
  hotMetalRatio?: Record<string, number>;

  @ApiPropertyOptional({
    description: '负荷限制',
    example: { "P负荷": 1.5, "S负荷": 8, "Mn负荷": 10.83 }
  })
  @IsOptional()
  @IsObject()
  loadTopLimits?: Record<string, number>;

  @ApiPropertyOptional({
    description: '铁水上限',
    example: { "P": 0.15, "S": 0.07, "Mn": 0.65 }
  })
  @IsOptional()
  @IsObject()
  ironWaterTopLimits?: Record<string, number>;

  @ApiPropertyOptional({
    description: '燃料参数列表',
    type: [Number],
    example: [1, 2, 3]
  })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  fuelParams?: number[];

  @ApiPropertyOptional({
    description: '原料参数列表',
    type: [Number],
    example: [56, 59, 60, 62, 64]
  })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  ingredientParams?: number[];

  @ApiPropertyOptional({
    description: '其他参数',
    example: {
      "块矿": [59, 62],
      "焦比": 420,
      "煤比": 140,
      "焦丁比": 55,
      "其他费用": 99.65
    }
  })
  @IsOptional()
  @IsObject()
  otherSettings?: Record<string, any>;
}
