import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsObject } from 'class-validator';

export class CreateCokeEconInfoDto {
  @ApiProperty({
    example: '一级冶金焦',
    description: '焦炭名称',
  })
  @IsNotEmpty({ message: '名称不能为空' })
  @IsString()
  name: string;

  /** 化学成分及经济指标 JSON 对象 */
  @ApiProperty({
    example: {
      固定碳: 86.5,
      灰分: 12.3,
      挥发分: 1.2,
      水分: 1.8,
      S: 0.65,
      CSR: 65,
      CRI: 23,
      M10: 6.5,
      M40: 78.2,
      热值: 7200,
      价格: 2850,
    },
    description: '化学成分及经济指标 JSON 对象',
  })
  @IsNotEmpty({ message: 'composition 不能为空' })
  @IsObject()
  composition: Record<string, any>;
}
