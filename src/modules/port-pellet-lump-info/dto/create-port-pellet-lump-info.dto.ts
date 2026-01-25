import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsObject,
  IsNumber,
  Min,
} from 'class-validator';

export class CreatePortPelletLumpInfoDto {
  @ApiProperty({ example: '1_4_印度球团', description: '球团/块矿名称' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: '青岛港', description: '港口' })
  @IsOptional()
  @IsString()
  port?: string;

  @ApiProperty({
    description: '化学成分及价格等指标',
    example: {
      TFe: 63.03,
      SiO2: 4.3,
      Al2O3: 3.84,
      P: 0.05,
      S: 0.0,
      MnO: 0.0,
      H2O: 0.0,
      粉率: 0.0,
      车板价: 89.9,
      运费: 0.0,
      干粉价格: 0.0,
      厂内筛分搬到等费用: 0.0,
      干基不含税: 0.0,
      CaO: 0.0,
      MgO: 0.0,
      TiO2: 0.0,
      Zn: 0.0,
      K2O: 0.0,
      Na2O: 0.0,
      Cr: 0.0,
      Cu: 0.0,
      As: 0.0,
      Ni: 0.0,
      烧损: 0.0,
    },
  })
  @IsNotEmpty()
  @IsObject()
  composition: Record<string, any>;

  @ApiPropertyOptional({ example: 1000, description: '库存数量' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  inventory?: number;

  @ApiPropertyOptional({ example: '长期协议', description: '备注' })
  @IsOptional()
  @IsString()
  remark?: string;
}
