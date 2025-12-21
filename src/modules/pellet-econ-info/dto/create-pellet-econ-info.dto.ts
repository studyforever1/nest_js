import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsObject } from 'class-validator';

export class CreatePelletEconInfoDto {
  @ApiProperty({
    example: '一级球团',
    description: '球团名称',
  })
  @IsNotEmpty({ message: '名称不能为空' })
  @IsString()
  name: string;

  /** 化学成分及经济指标 JSON 对象 */
  @ApiProperty({
    example: {
      Fe: 65.0,
      SiO2: 3.2,
      Al2O3: 1.1,
      CaO: 2.3,
      MgO: 0.5,
      价格: 1500,
      热值: 6500,
    },
    description: '化学成分及经济指标 JSON 对象',
  })
  @IsNotEmpty({ message: 'composition 不能为空' })
  @IsObject()
  composition: Record<string, any>;
}
