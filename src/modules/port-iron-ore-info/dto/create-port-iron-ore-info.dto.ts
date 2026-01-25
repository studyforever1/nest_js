import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsObject,
  IsNumber,
  Min,
} from 'class-validator';

export class CreatePortIronOreInfoDto {
  /** 矿粉名称 */
  @ApiProperty({ example: 'PB粉', description: '矿粉名称' })
  @IsNotEmpty()
  @IsString()
  name: string;

  /** 化学成分及指标 JSON 对象 */
  @ApiProperty({
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
  @IsNotEmpty()
  @IsObject()
  composition: Record<string, any>;

  /** 库存数量 */
  @ApiPropertyOptional({ example: 1000, description: '库存数量' })
  @IsOptional()
  @IsNumber({}, { message: 'inventory 必须是数字' })
  @Min(0, { message: '库存不能为负数' })
  inventory?: number;

  /** 港口 */
  @ApiPropertyOptional({ example: '青岛港', description: '港口' })
  @IsOptional()
  @IsString()
  port?: string;

  /** 备注 */
  @ApiPropertyOptional({ example: '长期协议矿', description: '备注' })
  @IsOptional()
  @IsString()
  remark?: string;
}
