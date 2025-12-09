import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsObject } from 'class-validator';

export class SaveSingleSinteringConfigDto {
  @ApiPropertyOptional({
    example: {
      其他参数设置: {
        制造费用: 47,
        燃料动力: 0,
        职工工资: 0,
        设置碱度: 1.85,
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
    },
    description: '单烧测算评价法参数设置（singleBurnSet）',
  })
  @IsOptional()
  @IsObject()
  params?: Record<string, any>;
}

