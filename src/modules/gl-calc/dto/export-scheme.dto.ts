// gl/dto/export-scheme.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsString } from 'class-validator';

export class GLExportSchemeDto {
  @ApiProperty({ description: '任务 UUID' })
  @IsString()
  @IsNotEmpty()
  taskUuid: string;

  @ApiProperty({ description: '要导出的方案序号数组' })
  @IsArray()
  indexes: number[];
}
