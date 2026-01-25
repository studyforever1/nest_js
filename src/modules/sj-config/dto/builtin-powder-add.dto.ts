// src/modules/sj-config/dto/builtin-powder-add.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class BuiltinPowderItemDto {
  @ApiProperty({ description: '物料名称', example: '精粉A' })
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: '上限', example: 80 })
  @IsNotEmpty()
  top_limit: number;

  @ApiProperty({ description: '下限', example: 0 })
  @IsNotEmpty()
  low_limit: number;
}

export class BuiltinPowderAddDto {
  @ApiProperty({ 
    description: '新增内置矿粉配比项', 
    type: [BuiltinPowderItemDto],
    example: [
      { name: '精粉A', top_limit: 80, low_limit: 0 },
      { name: '精粉B', top_limit: 75, low_limit: 5 }
    ]
  })
  @IsArray()
  @IsNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => BuiltinPowderItemDto)
  items: BuiltinPowderItemDto[];
}

