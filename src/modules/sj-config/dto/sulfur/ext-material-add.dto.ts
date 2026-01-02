// dto/sulfur/ext-material-add.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, Min } from 'class-validator';

export class ExtMaterialItemDto {
  @ApiProperty({ example: '高炉上料除尘' })
  @IsString()
  key: string;

  @ApiProperty({ example: 1.25 })
  @IsNumber()
  @Min(0)
  投料量: number;

  @ApiProperty({ example: 0.162 })
  @IsNumber()
  @Min(0)
  硫质量分数: number;
}

export class AddExtMaterialDto {
  @ApiProperty({ type: [ExtMaterialItemDto] })
  items: ExtMaterialItemDto[];
}
