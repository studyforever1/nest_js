import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsObject } from 'class-validator';

export class UpdateSjFinesChemTypDto {
  @ApiPropertyOptional({ description: '矿粉名称' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: '化学成分典型值（composition，JSON 对象）' })
  @IsOptional()
  @IsObject()
  composition?: Record<string, any>;
}
