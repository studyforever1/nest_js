// dto/sulfur/ext-material-delete.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';

export class DeleteExtMaterialDto {
  @ApiProperty({
    example: ['高炉上料除尘', '高炉矿槽除尘灰'],
  })
  @IsArray()
  @IsString({ each: true })
  keys: string[];
}
