import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsObject } from 'class-validator';

export class UpdateSjFinesChemTypDto {
  @ApiPropertyOptional({ description: '矿粉名称' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: '化学成分典型值（JSON）' })
  @IsOptional()
  @IsObject()
  chemValues?: Record<string, any>;
}
