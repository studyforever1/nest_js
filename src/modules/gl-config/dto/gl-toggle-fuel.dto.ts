import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNumber } from 'class-validator';

export class GLToggleFuelDto {
  @ApiProperty({ example: 1, description: '燃料ID' })
  @IsNumber()
  id: number;

  @ApiProperty({ example: true, description: '是否选中' })
  @IsBoolean()
  checked: boolean;
}