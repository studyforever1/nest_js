// dto/sulfur/other-exp-delete.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';

export class DeleteOtherSExpDto {
  @ApiProperty({
    example: ['返矿残留', '烧结机头除尘'],
  })
  @IsArray()
  @IsString({ each: true })
  keys: string[];
}
