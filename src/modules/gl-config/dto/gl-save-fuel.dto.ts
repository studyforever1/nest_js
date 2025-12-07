// dto/gl-save-fuel.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString } from 'class-validator';

export class GLSaveFuelDto {
  @ApiProperty({ description: '燃料ID列表' ,example: [1, 2]})
  @IsArray()
  fuelParams: number[];

  @ApiPropertyOptional({ description: '分类编号' ,example: ""})
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: '燃料名称',example: "" })
  @IsOptional()
  @IsString()
  name?: string;
}
