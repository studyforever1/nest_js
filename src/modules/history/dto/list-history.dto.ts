// src/modules/history/dto/list-history.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsString, IsInt, Min } from 'class-validator';
import { ModuleTypeEnum } from '../../../common/enums/module-type.enum';
import { Type } from 'class-transformer';

export class ListHistoryDto {
  @ApiPropertyOptional({ 
    description: '模块类型筛选',
    enum: ModuleTypeEnum, // ✅ Swagger 下拉枚举
    example: ModuleTypeEnum.SINTER_BLEND,
  })
  @IsOptional()
  @IsEnum(ModuleTypeEnum) // ✅ 校验必须是枚举值
  module_type?: ModuleTypeEnum;

  @ApiPropertyOptional({ description: '日期（YYYY-MM-DD），查询当天数据' })
  @IsOptional()
  @IsString()
  date?: string;

@Type(() => Number)
@IsInt()
@Min(1)
page?: number = 1;

@Type(() => Number)
@IsInt()
@Min(1)
pageSize?: number = 10;

}
