import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsObject } from 'class-validator';

export class SaveConfigDto {
  @ApiProperty({
    required: false,
    example: {},
    description: '原料参数设置（ingredientLimits），键为原料ID，值为各项限制'
  })
  @IsOptional()
  @IsObject()
  ingredientLimits?: Record<string, any>;

  @ApiProperty({
    required: false,
    example: {},
    description: '原料选中参数（ingredientParams），数组形式或对象'
  })
  @IsOptional()
  @IsObject()
  ingredientParams?: Record<string, any> | number[];

  @ApiProperty({
    required: false,
    example: {},
    description: '燃料参数限制（fuelLimits），键为燃料ID或化学成分，值为上下限'
  })
  @IsOptional()
  @IsObject()
  fuelLimits?: Record<string, any>;

  @ApiProperty({
    required: false,
    example: {},
    description: '燃料选中参数（fuelParams），数组形式或对象'
  })
  @IsOptional()
  @IsObject()
  fuelParams?: Record<string, any> | number[];

  @ApiProperty({
    required: false,
    example: {
      "R2": { "low_limit": 1.1, "top_limit": 1.3 }
    },
    description: '炉渣参数设置（slagLimits）'
  })
  @IsOptional()
  @IsObject()
  slagLimits?: Record<string, any>;

  @ApiProperty({
    required: false,
    example: { "P": 1, "MnO": 0.6 },
    description: '热金属比例（hotMetalRatio）'
  })
  @IsOptional()
  @IsObject()
  hotMetalRatio?: Record<string, any>;

  @ApiProperty({
    required: false,
    example: { "P负荷": 1.5 },
    description: '负荷上限（loadTopLimits）'
  })
  @IsOptional()
  @IsObject()
  loadTopLimits?: Record<string, any>;

  @ApiProperty({
    required: false,
    example: { "P": 0.15 },
    description: '铁水上限（ironWaterTopLimits）'
  })
  @IsOptional()
  @IsObject()
  ironWaterTopLimits?: Record<string, any>;

  @ApiProperty({
    required: false,
    example: { "块矿": [], "焦比": 420 },
    description: '其他参数设置（otherSettings）'
  })
  @IsOptional()
  @IsObject()
  otherSettings?: Record<string, any>;
}
