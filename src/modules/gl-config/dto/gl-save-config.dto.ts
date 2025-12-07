// dto/gl-save-config.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsObject } from 'class-validator';

export class GLSaveConfigDto {
  @ApiPropertyOptional({ description: '原料配比限制', type: Object })
  @IsOptional()
  @IsObject()
  ingredientLimits?: Record<string, any>;

  @ApiPropertyOptional({ description: '燃料配比限制', type: Object })
  @IsOptional()
  @IsObject()
  fuelLimits?: Record<string, any>;

  @ApiPropertyOptional({ description: '熔渣限制', type: Object })
  @IsOptional()
  @IsObject()
  slagLimits?: Record<string, any>;

  @ApiPropertyOptional({ description: '铁水比例', type: Object })
  @IsOptional()
  @IsObject()
  hotMetalRatio?: Record<string, any>;

  @ApiPropertyOptional({ description: '负荷限制', type: Object })
  @IsOptional()
  @IsObject()
  loadTopLimits?: Record<string, any>;

  @ApiPropertyOptional({ description: '其他参数', type: Object })
  @IsOptional()
  @IsObject()
  otherSettings?: Record<string, any>;
}
