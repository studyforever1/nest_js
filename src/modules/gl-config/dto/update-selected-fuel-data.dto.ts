// dto/update-selected-fuel-data.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsObject, IsNumber, Min, IsBoolean } from 'class-validator';

export class UpdateSelectedFuelDataDto {
  @ApiPropertyOptional({ example: 'F', description: '分类编号' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ example: '焦炭', description: '燃料名称' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    example: {
      TFe: 0.882,
      CaO: 0.605,
      SiO2: 5.92,
      MgO: 0.135,
      Al2O3: 3.53,
      S: 1,
      P: 0.063,
      TiO2: 0.151,
      MnO: 0,
      Cr: 0,
      Pb: 0.00328,
      Zn: 0.00491,
      K2O: 0.0735,
      Na2O: 0.0977,
      Ni: 0,
      V2O5: 0,
      H2O: 0,
      返焦率: 4,
      返焦价格: 700,
      干基价格: 1854.91
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

  @ApiPropertyOptional({ example: '2025-11-30 20:38:36', description: '创建时间' })
  @IsOptional()
  @IsString()
  created_at?: string;

  @ApiPropertyOptional({ example: '2025-12-07 19:36:05', description: '更新时间' })
  @IsOptional()
  @IsString()
  updated_at?: string;
}