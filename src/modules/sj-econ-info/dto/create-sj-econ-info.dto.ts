import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsObject } from 'class-validator';

export class CreateSjEconInfoDto {
  @ApiProperty({ 
    example: '甘肃格尔木', 
    description: '原料名称' 
  })
  @IsNotEmpty({ message: '名称不能为空' })
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
}

