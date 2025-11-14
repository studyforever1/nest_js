import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsArray, IsIn, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateRoomDto {
  @ApiProperty({ description: '群聊名称（群聊必填）', required: false ,example: "房间1"})
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({
    description: '房间类型',
    enum: ['private', 'group'],
    default: 'private',
  })
  @IsIn(['private', 'group'])
  type: 'private' | 'group' = 'private';

  @ApiProperty({
    description: '成员ID列表（数字数组）',
    type: [Number],
    example: [2, 3],
  })
  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsNumber({}, { each: true })
  memberIds: number[] = [];
}
