// gl-delete-process-cost.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty } from 'class-validator';

export class GLDeleteProcessCostDto {
  @ApiProperty({
    description: '待删除项目名数组',
    example: ['水费', '电费'],
  })
  @IsArray()
  @IsNotEmpty()
  keys: string[];
}
