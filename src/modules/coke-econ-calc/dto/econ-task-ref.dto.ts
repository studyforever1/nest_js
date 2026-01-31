import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID } from 'class-validator';

export class EconTaskRefDto {
  @ApiProperty({
    description: '任务 UUID',
    example: 'ff66b09f-f61a-4344-8ed4-923bed7d2f56',
  })
  @IsUUID()
  taskUuid: string;

  @ApiProperty({
    description: '评价方法名称（用于区分不同模型）',
    example: '焦炭性价比评价法',
  })
  @IsString()
  name: string;
}
