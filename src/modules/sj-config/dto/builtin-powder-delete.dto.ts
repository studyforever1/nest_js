// src/modules/sj-config/dto/builtin-powder-delete.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty } from 'class-validator';

export class BuiltinPowderDeleteDto {
  @ApiProperty({ description: '待删除物料名称数组', example: ['精粉A', '精粉B'] })
  @IsArray()
  @IsNotEmpty()
  keys: string[];
}

