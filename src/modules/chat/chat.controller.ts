import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { ChatService } from './chat.service';
import { UserService } from '../user/user.service';
import { SendMessageDto } from './dto/send-message.dto';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';

@ApiTags('Chat') // Swagger 分组
@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly userService: UserService,
  ) {}

  /** 发送消息 */
  @Post('send')
  @ApiOperation({ summary: '发送消息' })
  @ApiBody({ type: SendMessageDto })
  async sendMessage(@Body() dto: SendMessageDto) {
    const sender = await this.userService.findOne(dto.senderId);
    const receiver = await this.userService.findOne(dto.receiverId);

    if (!sender || !receiver) {
      throw new Error('发送者或接收者不存在');
    }

    return this.chatService.sendMessage(sender, receiver, dto.content);
  }

  /** 获取对话 */
  @Get(':userId1/:userId2')
  @ApiOperation({ summary: '获取对话' })
  async getConversation(
    @Param('userId1') userId1: number,
    @Param('userId2') userId2: number,
  ) {
    return this.chatService.getConversation(userId1, userId2);
  }
}
