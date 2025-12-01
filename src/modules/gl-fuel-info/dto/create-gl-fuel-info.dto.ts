import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsString, IsOptional, IsNumber, Min } from 'class-validator';

export class CreateGlFuelInfoDto {
  @ApiProperty({ example: 'F', description: '燃料默认F' })
  @IsNotEmpty()
  @IsString()
  category: string;

  @ApiProperty({ example: '焦炭', description: '燃料名称' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({
    example: {
      TFe: 53.49,
      Al2O3: 0.05,
      CaO: 0.04,
      Cr: 0,
      K2O: 0,
      MgO: 0,
      MnO: 0.03,
      Na2O: 12,
      Ni: 0.07,
      P: 1.55,
      Pb: 0,
      S: 0.13,
      SiO2: 6.14,
      TiO2: 0.3,
      V2O5: 0,
      Zn: 1.91,
      H2O: 0,
      返矿率: 14,
      返矿价格: 500,
      干基价格: 895.6,
    },
    description: '化学成分及其他指标 JSON 对象',
  })
  @IsNotEmpty()
  @IsObject()
  composition: Record<string, any>;

  @ApiProperty({ example: 1000, description: '库存数量' })
  @IsOptional()
  @IsNumber({}, { message: 'inventory 必须是数字' })
  @Min(0, { message: '库存不能为负数' })
  inventory?: number;

  @ApiProperty({ example: '备注信息', description: '备注' })
  @IsOptional()
  @IsString()
  remark?: string;
}
