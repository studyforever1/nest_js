import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: { origin: '*' },
})
export class NotificationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  // 存用户连接
  private userSocketMap = new Map<number, Set<Socket>>();

  /** 连接 */
 handleConnection(socket: Socket) {
  const userId = socket.data.userId;

  if (!this.userSocketMap.has(userId)) {
    this.userSocketMap.set(userId, new Set());
  }

  this.userSocketMap.get(userId)!.add(socket);

  console.log(`用户 ${userId} 已连接，当前连接数: ${this.userSocketMap.get(userId)!.size}`);
}

  /** 断开 */
  handleDisconnect(socket: Socket) {
  const userId = socket.data.userId;

  const set = this.userSocketMap.get(userId);
  if (set) {
    set.delete(socket);

    if (set.size === 0) {
      this.userSocketMap.delete(userId);
    }
  }

  console.log(`用户 ${userId} 断开`);
}

  sendToUser(userId: number, data: any) {
  const sockets = this.userSocketMap.get(userId);

  if (!sockets || sockets.size === 0) {
    console.warn(`⚠️ 用户未连接: ${userId}`);
    return;
  }

  sockets.forEach((socket) => {
    if (socket.connected) {
      socket.emit('notification', data);
    }
  });
}
}