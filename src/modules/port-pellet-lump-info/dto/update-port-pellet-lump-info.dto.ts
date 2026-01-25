import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsObject,
  IsNumber,
  Min,
} from 'class-validator';

export class UpdatePortPelletLumpInfoDto {
  @ApiPropertyOptional({ description: '名称' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: '港口' })
  @IsOptional()
  @IsString()
  port?: string;

  @ApiPropertyOptional({ description: '化学成分及指标' })
  @IsOptional()
  @IsObject()
  composition?: Record<string, any>;

  @ApiPropertyOptional({ description: '库存数量' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  inventory?: number;

  @ApiPropertyOptional({ description: '备注' })
  @IsOptional()
  @IsString()
  remark?: string;
}
