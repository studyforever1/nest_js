import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumber, IsIn, ValidateIf } from 'class-validator';

export class CreateMessageDto {
  @ApiProperty({ description: '房间ID', required: true })
  @IsNumber()
  roomId: number;

  @ApiProperty({ description: '消息内容', required: true })
  @IsString()
  content: string;

  @ApiProperty({ description: '消息类型', enum: ['text', 'image', 'file'], default: 'text' })
  @IsOptional()
  @IsIn(['text', 'image', 'file'])
  messageType?: 'text' | 'image' | 'file' = 'text';

  @ApiProperty({ description: '文件URL（文件消息必填）', required: false })
  @ValidateIf((o) => o.messageType === 'file')
  @IsString()
  fileUrl?: string;
}
