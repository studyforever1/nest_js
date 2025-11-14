import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength, IsOptional, IsNumber, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';
import { ChemicalComposition, PriceField, PercentageField, RequiredStringField, OptionalStringField } from '../../../common/decorators/validation.decorator';
import { QueryDto } from '../../../common/dto/pagination.dto';

export class CreateSjFinesChemTypDto {
  @RequiredStringField('分类编号', 50)
  categoryCode: string;

  @RequiredStringField('原料名称', 100)
  materialName: string;

  @ChemicalComposition('TFe含量(%)')
  tfe?: number = 0;

  @ChemicalComposition('CaO含量(%)')
  cao?: number = 0;

  @ChemicalComposition('SiO2含量(%)')
  sio2?: number = 0;

  @ChemicalComposition('MgO含量(%)')
  mgo?: number = 0;

  @ChemicalComposition('Al2O3含量(%)')
  al2o3?: number = 0;

  @ChemicalComposition('S含量(%)')
  s?: number = 0;

  @ChemicalComposition('P含量(%)')
  p?: number = 0;

  @ChemicalComposition('TiO2含量(%)')
  tio2?: number = 0;

  @ChemicalComposition('MnO含量(%)')
  mno?: number = 0;

  @ChemicalComposition('Cr含量(%)')
  cr?: number = 0;

  @ChemicalComposition('Pb含量(%)')
  pb?: number = 0;

  @ChemicalComposition('Zn含量(%)')
  zn?: number = 0;

  @ChemicalComposition('K2O含量(%)')
  k2o?: number = 0;

  @ChemicalComposition('Na2O含量(%)')
  na2o?: number = 0;

  @ChemicalComposition('Ni含量(%)')
  ni?: number = 0;

  @ChemicalComposition('V2O5含量(%)')
  v2o5?: number = 0;

  @ChemicalComposition('H2O含量(%)')
  h2o?: number = 0;

  @PercentageField('烧毁(%)')
  burnOff?: number = 0;

  @PriceField('价格(元/吨)')
  price?: number = 0;

  @PercentageField('返矿率(%)')
  returnOreRate?: number = 0;

  @PriceField('返矿价格(元/吨)')
  returnOrePrice?: number = 0;

  @PriceField('干基价格(元/吨)')
  dryBasePrice?: number = 0;
}

export class UpdateSjFinesChemTypDto {
  @OptionalStringField('分类编号', 50)
  categoryCode?: string;

  @OptionalStringField('原料名称', 100)
  materialName?: string;

  @ChemicalComposition('TFe含量(%)')
  tfe?: number;

  @ChemicalComposition('CaO含量(%)')
  cao?: number;

  @ChemicalComposition('SiO2含量(%)')
  sio2?: number;

  @ChemicalComposition('MgO含量(%)')
  mgo?: number;

  @ChemicalComposition('Al2O3含量(%)')
  al2o3?: number;

  @ChemicalComposition('S含量(%)')
  s?: number;

  @ChemicalComposition('P含量(%)')
  p?: number;

  @ChemicalComposition('TiO2含量(%)')
  tio2?: number;

  @ChemicalComposition('MnO含量(%)')
  mno?: number;

  @ChemicalComposition('Cr含量(%)')
  cr?: number;

  @ChemicalComposition('Pb含量(%)')
  pb?: number;

  @ChemicalComposition('Zn含量(%)')
  zn?: number;

  @ChemicalComposition('K2O含量(%)')
  k2o?: number;

  @ChemicalComposition('Na2O含量(%)')
  na2o?: number;

  @ChemicalComposition('Ni含量(%)')
  ni?: number;

  @ChemicalComposition('V2O5含量(%)')
  v2o5?: number;

  @ChemicalComposition('H2O含量(%)')
  h2o?: number;

  @PercentageField('烧毁(%)')
  burnOff?: number;

  @PriceField('价格(元/吨)')
  price?: number;

  @PercentageField('返矿率(%)')
  returnOreRate?: number;

  @PriceField('返矿价格(元/吨)')
  returnOrePrice?: number;

  @PriceField('干基价格(元/吨)')
  dryBasePrice?: number;
}

export class QuerySjFinesChemTypDto extends QueryDto {
  @ApiProperty({ description: '分类编号', required: false })
  @IsOptional()
  @IsString()
  categoryCode?: string;

  @ApiProperty({ description: '原料名称', required: false })
  @IsOptional()
  @IsString()
  materialName?: string;

  @ApiProperty({ description: 'TFe含量最小值', required: false, type: 'number' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  @Transform(({ value }) => parseFloat(value))
  tfeMin?: number;

  @ApiProperty({ description: 'TFe含量最大值', required: false, type: 'number' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  @Transform(({ value }) => parseFloat(value))
  tfeMax?: number;

  @ApiProperty({ description: '价格最小值', required: false, type: 'number' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Transform(({ value }) => parseFloat(value))
  priceMin?: number;

  @ApiProperty({ description: '价格最大值', required: false, type: 'number' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Transform(({ value }) => parseFloat(value))
  priceMax?: number;

  @ApiProperty({ description: '开始日期', required: false, type: 'string', format: 'date' })
  @IsOptional()
  @Transform(({ value }) => value ? new Date(value) : undefined)
  startDate?: Date;

  @ApiProperty({ description: '结束日期', required: false, type: 'string', format: 'date' })
  @IsOptional()
  @Transform(({ value }) => value ? new Date(value) : undefined)
  endDate?: Date;
}
