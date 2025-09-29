import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ArrayNotEmpty, IsInt, IsString, ValidateIf, IsIn } from 'class-validator';

export class DeleteHistoryDto {
  @ApiProperty({ 
    description: '要删除的历史记录 ID，可单个或数组', 
    type: [Number] 
  })
  @IsArray({ message: 'ids 必须是数组' })
  @ArrayNotEmpty({ message: 'ids 不能为空数组' })
  @ValidateIf(o => o.ids.every(id => typeof id === 'number' || typeof id === 'string'))
  ids: number[] | string[];
}
