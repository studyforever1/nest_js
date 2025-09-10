import { 
  WebSocketGateway, 
  SubscribeMessage, 
  MessageBody, 
  ConnectedSocket 
} from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { ChatService } from './chat.service';

@WebSocketGateway({ cors: true })
export class ChatGateway {
  constructor(private readonly chatService: ChatService) {}

  /** 处理发送消息 */
  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @MessageBody() data: { senderId: number; receiverId: number; content: string },
    @ConnectedSocket() client: Socket,
  ) {
    const msg = await this.chatService.sendMessage(
      { user_id: data.senderId } as any,
      { user_id: data.receiverId } as any,
      data.content,
    );

    // 发送给接收方
    client.broadcast.emit(`chat_${data.receiverId}`, msg);

    // 也返回给自己
    return msg;
  }
}
