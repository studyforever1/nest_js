import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsObject } from 'class-validator';

export class UpdateLumpMetallurgyPropDto {
  @ApiPropertyOptional({ description: '块矿名称' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: '块矿冶金性能（composition，JSON 对象）' })
  @IsOptional()
  @IsObject()
  composition?: Record<string, any>;
}
