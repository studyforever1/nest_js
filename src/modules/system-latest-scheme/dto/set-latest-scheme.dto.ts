// src/system-latest-scheme/dto/set-latest-scheme.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsInt, Min, IsEnum } from 'class-validator';
import { ModuleTypeEnum } from '../../../common/enums/module-type.enum';

export class SetLatestSchemeDto {
  @ApiProperty({
    example: '563d4d59-eb83-4df9-ace1-62d97c5b624d',
    description: '任务 UUID',
  })
  @IsString()
  taskUuid: string;

  @ApiProperty({
    example: 0,
    description: '方案序号',
  })
  @IsInt()
  @Min(0)
  schemeIndex: number;

  @ApiProperty({
    example: ModuleTypeEnum.SINTER_BLEND,
    enum: ModuleTypeEnum,
    description: '模块类型（枚举）',
  })
  @IsEnum(ModuleTypeEnum)
  module_type: ModuleTypeEnum;
}
