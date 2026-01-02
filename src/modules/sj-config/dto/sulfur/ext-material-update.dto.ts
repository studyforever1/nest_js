// dto/sulfur/ext-material-update.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsNumber, IsString, Min } from 'class-validator';

export class UpdateExtMaterialDto {
  @ApiProperty({ example: '高炉上料除尘' })
  @IsString()
  key: string;

  @ApiProperty({ example: 1.3, required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  投料量?: number;

  @ApiProperty({ example: 0.17, required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  硫质量分数?: number;
}
