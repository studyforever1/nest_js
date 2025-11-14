import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { ChatService } from './chat.service';
import { Socket, Server } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@WebSocketGateway({ cors: true })
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private onlineUsers: Map<number, Socket> = new Map();

  constructor(
    private readonly chatService: ChatService,
    private readonly jwtService: JwtService,
  ) {}

  /** 初始化网关 */
  afterInit(server: Server) {
    console.log('Chat Gateway initialized');
  }

  /** 用户连接 */
  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.query.token as string;
      const payload = this.jwtService.verify<JwtPayload>(token);
      client.data.userId = payload.sub;
      this.onlineUsers.set(payload.sub, client);
      console.log(`User ${payload.sub} connected`);
    } catch (err) {
      client.disconnect();
    }
  }

  /** 用户断开连接 */
  handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    if (userId) {
      this.onlineUsers.delete(userId);
      console.log(`User ${userId} disconnected`);
    }
  }

  /** 发送消息 */
  @SubscribeMessage('sendMessage')
  async handleMessage(
    @MessageBody() body: { roomKey: string; content: string },
    @ConnectedSocket() client: Socket,
  ) {
    const senderId = client.data.userId;

    // 1️⃣ 通过 roomKey 创建消息
    const message = await this.chatService.sendMessageByKey(
      senderId,
      body.roomKey,
      body.content,
    );

    // 2️⃣ 获取房间成员
    const members = await this.chatService.getRoomMembersByKey(body.roomKey);

    // 3️⃣ 给在线成员推送消息
    members.forEach((user) => {
      const socket = this.onlineUsers.get(user.user_id);
      if (socket) socket.emit('receiveMessage', message);
    });

    return message;
  }
}
