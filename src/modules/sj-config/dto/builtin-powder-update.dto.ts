// src/modules/sj-config/dto/builtin-powder-update.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsNumber, IsOptional } from 'class-validator';

export class BuiltinPowderUpdateDto {
  @ApiProperty({ description: '要更新的物料名称', example: '精粉A' })
  @IsString()
  @IsNotEmpty()
  key: string;

  @ApiProperty({ description: '物料名称（可选）', example: '精粉A', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ description: '上限（可选）', example: 85, required: false })
  @IsOptional()
  @IsNumber()
  top_limit?: number;

  @ApiProperty({ description: '下限（可选）', example: 5, required: false })
  @IsOptional()
  @IsNumber()
  low_limit?: number;
}

