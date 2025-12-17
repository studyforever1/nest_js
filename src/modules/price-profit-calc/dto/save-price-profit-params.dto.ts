import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional } from 'class-validator';

export class SavePriceProfitParamsDto {
  @ApiPropertyOptional({ description: '港口资源' })
  @IsOptional()
  @IsObject()
  portPrice?: Record<string, number>;

  @ApiPropertyOptional({ description: '当地资源' })
  @IsOptional()
  @IsObject()
  localPrice?: Record<string, number>;

  @ApiPropertyOptional({ description: '原料成分设置' })
  @IsOptional()
  @IsObject()
  ingredientSet?: Record<string, any>;

  @ApiPropertyOptional({ description: '焦煤成分设置' })
  @IsOptional()
  @IsObject()
  cokeSet?: Record<string, any>;

  @ApiPropertyOptional({ description: '现价资源' })
  @IsOptional()
  @IsObject()
  resourceSet?: Record<string, any>;

  @ApiPropertyOptional({ description: '基准参数设置' })
  @IsOptional()
  @IsObject()
  baseParaSet?: Record<string, number>;

  @ApiPropertyOptional({ description: '轧钢炼钢参数设置' })
  @IsOptional()
  @IsObject()
  steelMakingParaSet?: Record<string, number>;
}
