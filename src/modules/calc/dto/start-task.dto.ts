// src/calc/dto/start-task.dto.ts
import { IsString, IsNotEmpty, IsObject, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class StartTaskDto {
  @ApiProperty({ description: '计算类型' })
  @IsString()
  @IsNotEmpty()
  calculateType: string;

  @ApiProperty({ description: '原料参数', type: Object })
  @IsObject()
  ingredientParams: any;

  @ApiProperty({ description: '原料限制', type: Object })
  @IsObject()
  ingredientLimits: any;

  @ApiProperty({ description: '化学成分限制', type: Object })
  @IsObject()
  chemicalLimits: any;

  @ApiProperty({ description: '其他设置', type: Object })
  @IsObject()
  otherSettings: any;

  @ApiProperty({ description: '用户ID' })
  @IsNumber()
  userId: number;
}
