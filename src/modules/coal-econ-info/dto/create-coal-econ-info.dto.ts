import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsObject } from 'class-validator';

export class CreateCoalEconInfoDto {
  @ApiProperty({
    example: '优质动力煤',
    description: '煤炭名称',
  })
  @IsNotEmpty({ message: '名称不能为空' })
  @IsString()
  name: string;

  /** 化学成分及经济指标 JSON 对象 */
  @ApiProperty({
    example: {
      挥发分: 30.5,
      灰分: 10.2,
      水分: 8.5,
      热值: 5500,
      价格: 1200,
      物料类别: '动力煤',
    },
    description: '化学成分及经济指标 JSON 对象',
  })
  @IsNotEmpty({ message: 'composition 不能为空' })
  @IsObject()
  composition: Record<string, any>;
}
