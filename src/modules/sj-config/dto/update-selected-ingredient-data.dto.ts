// dto/update-selected-ingredient-data.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsObject, IsNumber, Min } from 'class-validator';

export class UpdateSelectedIngredientDataDto {
  @ApiPropertyOptional({ example: 'X', description: '分类编号' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ example: '自混料_', description: '原料名称' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    example: {
      TFe: 46,
      SiO2: 6.95,
      CaO: 15.95,
      MgO: 2.87,
      Al2O3: 2.22,
      P: 0.1,
      S: 0.52,
      TiO2: 0.27,
      K2O: 0.22,
      Na2O: 0.19,
      Zn: 0.07,
      H2O: 0,
      烧损: 8,
      价格: 0
    },
    description: '化学成分及指标 JSON 对象',
  })
  @IsOptional()
  @IsObject()
  composition?: Record<string, any>;

  @ApiPropertyOptional({ example: 1000, description: '库存数量' })
  @IsOptional()
  @IsNumber({}, { message: 'inventory 必须是数字' })
  @Min(0, { message: '库存不能为负数' })
  inventory?: number;

  @ApiPropertyOptional({ example: '其他粉矿', description: '产地' })
  @IsOptional()
  @IsString()
  origin?: string;

  @ApiPropertyOptional({ example: '备注信息', description: '备注' })
  @IsOptional()
  @IsString()
  remark?: string;
}