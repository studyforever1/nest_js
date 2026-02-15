// dto/update-selected-ingredient-data.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsObject, IsNumber, Min, IsBoolean } from 'class-validator';

export class UpdateSelectedIngredientDataDto {
  @ApiPropertyOptional({ example: 'K', description: '分类编号' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ example: '硅石', description: '原料名称' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    example: {
      TFe: 0,
      CaO: 0.6,
      SiO2: 93.32,
      MgO: 0,
      Al2O3: 0,
      S: 0,
      P: 0,
      TiO2: 0,
      MnO: 0,
      Cr: 0,
      Pb: 0,
      Zn: 0,
      K2O: 0,
      Na2O: 0,
      Ni: 0,
      V2O5: 0,
      H2O: 0,
      返焦率: 0,
      返矿价格: 500,
      干基价格: 132.74
    },
    description: '化学成分及指标 JSON 对象',
  })
  @IsOptional()
  @IsObject()
  composition?: Record<string, number>;

  @ApiPropertyOptional({ example: 1000, description: '库存数量' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  inventory?: number;

  @ApiPropertyOptional({ example: '其他粉矿', description: '产地' })
  @IsOptional()
  @IsString()
  origin?: string;

  @ApiPropertyOptional({ example: '备注信息', description: '备注' })
  @IsOptional()
  @IsString()
  remark?: string;

  @ApiPropertyOptional({ example: true, description: '是否启用' })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ example: 'admin', description: '修改人' })
  @IsOptional()
  @IsString()
  modifier?: string;

  @ApiPropertyOptional({ example: '2025-12-06 13:14:57', description: '创建时间' })
  @IsOptional()
  @IsString()
  created_at?: string;

  @ApiPropertyOptional({ example: '2025-12-07 19:34:34', description: '更新时间' })
  @IsOptional()
  @IsString()
  updated_at?: string;
}