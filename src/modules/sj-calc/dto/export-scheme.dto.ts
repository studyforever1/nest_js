import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsNumber } from 'class-validator';

export class ExportSchemeDto {
  @ApiProperty({ description: '任务 UUID', example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsString()
  @IsNotEmpty()
  taskUuid: string;

  @ApiProperty({ description: '方案序号', example: 0 })
  @IsNumber()
  @IsNotEmpty()
  index: number;
}
