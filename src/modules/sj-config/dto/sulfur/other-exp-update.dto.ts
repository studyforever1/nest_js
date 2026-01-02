// dto/sulfur/other-exp-update.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsNumber, IsString, Min } from 'class-validator';

export class UpdateOtherSExpDto {
  @ApiProperty({ example: '返矿残留' })
  @IsString()
  key: string;

  @ApiProperty({ example: 22.1, required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  产出量?: number;

  @ApiProperty({ example: 0.018, required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  携带硫的质量分数?: number;
}
