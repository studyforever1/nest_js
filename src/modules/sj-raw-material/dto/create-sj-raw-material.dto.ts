import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsObject } from 'class-validator';

export class CreateSjRawMaterialDto {
  @ApiProperty({ example: 'X', description: '分类编号' })
  @IsNotEmpty()
  @IsString()
  category: string;

  @ApiProperty({ example: '国有资产格尔木', description: '原料名称' })
  @IsNotEmpty()
  @IsString()
  name: string;

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
      As: 0.0,
      Pb: 0.0,
      V2O5: 0.0,
      H2O: 0.0,
      烧损: 1.15,
      价格: 1050.0,
    },
    description: '化学成分及指标 JSON 对象',
  })
  @IsNotEmpty()
  @IsObject()
  composition: Record<string, any>;

  @ApiProperty({ example: '格尔木', description: '产地' })
  @IsOptional()
  @IsString()
  origin?: string;

  @ApiProperty({ example: '备注信息', description: '备注' })
  @IsOptional()
  @IsString()
  remark?: string;
}
