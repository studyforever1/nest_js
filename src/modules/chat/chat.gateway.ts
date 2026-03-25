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
import { PresenceService } from '../notification/presence.service';
import { NotificationGateway } from '../notification/notification.gateway';

@WebSocketGateway({ cors: true })
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private onlineUsers: Map<number, Socket> = new Map();

  constructor(
    private readonly chatService: ChatService,
    private readonly jwtService: JwtService,
    private readonly presence: PresenceService,
  ) {}

  /** 初始化网关 */
  afterInit(server: Server) {
    console.log('Chat Gateway initialized');
  }

  /** 用户连接 */
  async handleConnection(client: Socket) {
    try {
      const token = NotificationGateway.extractTokenFromHandshake(client);
      if (!token) {
        client.disconnect();
        return;
      }
      const payload = this.jwtService.verify<JwtPayload>(token);
      // JWT 的 sub 在不同实现里可能是字符串；chat/notification 的映射 key 统一使用 number
      const userId = Number(payload.sub);
      if (!Number.isFinite(userId)) {
        client.disconnect();
        return;
      }

      client.data.userId = userId;
      this.onlineUsers.set(userId, client);
      this.presence.trackSocket(userId, client);
      console.log(`User ${userId} connected`);
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
    this.presence.untrackSocket(client);
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
