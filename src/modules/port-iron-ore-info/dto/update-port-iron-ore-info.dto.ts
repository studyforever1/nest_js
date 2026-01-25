import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsObject,
  IsNumber,
  Min,
} from 'class-validator';

export class UpdatePortIronOreInfoDto {
  @ApiPropertyOptional({ example: 'PB粉', description: '矿粉名称' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    example: {
      TFe: 62.4,
      SiO2: 3.86,
      CaO: 1.76,
      MgO: 3.16,
      Al2O3: 1.25,
      P: 0.03,
      S: 0.67,
      TiO2: 0.58,
      K2O: 0.02,
      Na2O: 0.03,
      Zn: 0.09,
      H2O: 0.0,
      烧损: 1.15,
      价格: 1050.0,
    },
    description: '化学成分及指标 JSON 对象',
  })
  @IsOptional()
  @IsObject()
  composition?: Record<string, any>;

  @ApiPropertyOptional({ example: 800, description: '库存数量' })
  @IsOptional()
  @IsNumber({}, { message: 'inventory 必须是数字' })
  @Min(0, { message: '库存不能为负数' })
  inventory?: number;

  /** 港口 */
  @ApiPropertyOptional({ example: '日照港', description: '港口' })
  @IsOptional()
  @IsString()
  port?: string;

  @ApiPropertyOptional({ example: '库存偏紧', description: '备注' })
  @IsOptional()
  @IsString()
  remark?: string;
}
