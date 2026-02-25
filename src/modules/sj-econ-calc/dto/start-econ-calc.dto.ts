import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString } from 'class-validator';
import { EconDataSourceType } from '../enums/econ-data-source-type.enum';

export class StartEconCalcDto {
  @ApiProperty({
    description: '计算类型（模块名，如 烧结原料经济性评价）',
    example: '烧结原料经济性评价'
  })
  @IsString()
  calculateType: string;

  @ApiProperty({
    description: '数据来源类型',
    enum: EconDataSourceType,
    example: EconDataSourceType.ECON
  })
  @IsEnum(EconDataSourceType)
  dataSourceType: EconDataSourceType;
}