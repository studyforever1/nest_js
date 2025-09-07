import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsNumber, IsString } from 'class-validator';

export class CreateSjRawMaterialDto {
  @ApiProperty({ example: '01', description: '分类编号' })
  @IsOptional()
  @IsString()
  category_code?: string;

  @ApiProperty({ example: '巴西粉矿', description: '原料名称' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ example: 62.5, description: 'TFe 含量' })
  @IsOptional()
  @IsNumber()
  tfe?: number;

  @ApiProperty({ example: 6.2, description: 'SiO2 含量' })
  @IsOptional()
  @IsNumber()
  sio2?: number;

  @ApiProperty({ example: 0.5, description: 'CaO 含量' })
  @IsOptional()
  @IsNumber()
  cao?: number;

  @ApiProperty({ example: 1.5, description: 'MgO 含量' })
  @IsOptional()
  @IsNumber()
  mgo?: number;

  @ApiProperty({ example: 2.1, description: 'Al2O3 含量' })
  @IsOptional()
  @IsNumber()
  al2o3?: number;

  @ApiProperty({ example: 0.05, description: 'P 含量' })
  @IsOptional()
  @IsNumber()
  p?: number;

  @ApiProperty({ example: 0.02, description: 'S 含量' })
  @IsOptional()
  @IsNumber()
  s?: number;

  @ApiProperty({ example: 0.2, description: 'TiO2 含量' })
  @IsOptional()
  @IsNumber()
  tio2?: number;

  @ApiProperty({ example: 0.1, description: 'K2O 含量' })
  @IsOptional()
  @IsNumber()
  k2o?: number;

  @ApiProperty({ example: 0.1, description: 'Na2O 含量' })
  @IsOptional()
  @IsNumber()
  na2o?: number;

  @ApiProperty({ example: 0.01, description: 'Zn 含量' })
  @IsOptional()
  @IsNumber()
  zn?: number;

  @ApiProperty({ example: 0.01, description: 'As 含量' })
  @IsOptional()
  @IsNumber()
  as_?: number;

  @ApiProperty({ example: 0.01, description: 'Pb 含量' })
  @IsOptional()
  @IsNumber()
  pb?: number;

  @ApiProperty({ example: 0.01, description: 'V2O5 含量' })
  @IsOptional()
  @IsNumber()
  v2o5?: number;

  @ApiProperty({ example: 5.0, description: 'H2O 含量' })
  @IsOptional()
  @IsNumber()
  h2o?: number;

  @ApiProperty({ example: 8.0, description: '烧损' })
  @IsOptional()
  @IsNumber()
  loss?: number;

  @ApiProperty({ example: 750, description: '价格(元/吨)' })
  @IsOptional()
  @IsNumber()
  price?: number;

  @ApiProperty({ example: '巴西', description: '产地' })
  @IsOptional()
  @IsString()
  origin?: string;
}
