import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsObject } from 'class-validator';

export class SaveHotMetalCostConfigDto {
  @ApiPropertyOptional({
    example: {
      其他参数设置: {
        喷煤价格: 900,
        基准品位: 57,
        基准燃料比: 519,
        烧结制造费用: 47,
        烧结动力费用: 0,
        焦炭价格: 1850,
        煤比: 145,
        生铁Si: 0.45,
        目标渣碱度: 1.2,
        镁铝比: 0.62,
        高炉其他费用: 2.44,
        高炉动力费用: 0,
      },
      原料成分设置: {
        混匀料: {
          Al2O3: 2.51,
          CaO: 0.71,
          K2O: 0.06,
          MgO: 0.53,
          Na2O: 0.078,
          P: 0.048,
          S: 0.051,
          SiO2: 9.58,
          TFe: 58.9,
          TiO2: 0.255,
          Zn: 0.013,
          价格: 500,
          原料: 'PB粉',
          干配比: 0,
          烧损: 5,
        },
      },
      焦炭和煤成分设置: {
        喷吹煤: {
          Al2O3: 38.77,
          CaO: 1.01,
          MgO: 0.24,
          SiO2: 50.7,
          TFe: 3.67,
          灰分: 10.7,
        },
        焦炭: {
          Al2O3: 36.77,
          CaO: 4.42,
          MgO: 0.68,
          SiO2: 46.24,
          TFe: 2.33,
          灰分: 12.5,
        },
      },
    },
    description: '铁水成本评价法参数设置（ironCostSet）',
  })
  @IsOptional()
  @IsObject()
  params?: Record<string, any>;
}

