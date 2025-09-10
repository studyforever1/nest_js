import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class SendMessageDto {
  @ApiProperty({ description: '发送者ID' })
  @IsNumber()
  senderId: number;

  @ApiProperty({ description: '接收者ID' })
  @IsNumber()
  receiverId: number;

  @ApiProperty({ description: '消息内容' })
  @IsNotEmpty()
  @IsString()
  content: string;
}
