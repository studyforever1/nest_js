// dto/sulfur/other-exp-add.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  Min,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class OtherSExpItemDto {
  @ApiProperty({
    description: '支出项名称',
    example: '返矿残留',
  })
  @IsString()
  key: string;

  @ApiProperty({
    description: '产出量',
    example: 20.83,
  })
  @IsNumber()
  @Min(0)
  产出量: number;

  @ApiProperty({
    description: '携带硫的质量分数',
    example: 0.016,
  })
  @IsNumber()
  @Min(0)
  携带硫的质量分数: number;
}

export class AddOtherSExpDto {
  @ApiProperty({
    type: [OtherSExpItemDto],
    description: '支出信息列表',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OtherSExpItemDto)
  items: OtherSExpItemDto[];
}
