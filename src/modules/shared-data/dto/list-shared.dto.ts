import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ModuleTypeEnum } from '../../../common/enums/module-type.enum';

export class ListSharedDto {
  @ApiPropertyOptional({ 
    description: '模块类型', 
    enum: ModuleTypeEnum, 
    example: ModuleTypeEnum.SINTER_BLEND 
  })
  @IsOptional()
  @IsEnum(ModuleTypeEnum)
  module_type?: ModuleTypeEnum;

  @ApiPropertyOptional({ description: '日期（YYYY-MM-DD）' })
  @IsOptional()
  @IsString()
  date?: string;

  @ApiPropertyOptional({ description: '页码', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: '每页数量', example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number = 10;
}
