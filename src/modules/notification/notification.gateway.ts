import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PresenceService } from './presence.service';

@WebSocketGateway({
  cors: { origin: '*' },
})
export class NotificationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private readonly presence: PresenceService) {}

  /** 供 ChatGateway 复用：与握手时取 token 规则一致 */
  static extractTokenFromHandshake(socket: Socket): string | undefined {
    const q = socket.handshake.query?.token;
    if (typeof q === 'string' && q) return q;
    if (Array.isArray(q) && q[0]) return q[0];
    const authToken = socket.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken) return authToken;
    const hdr = socket.handshake.headers?.authorization;
    if (typeof hdr === 'string' && hdr.toLowerCase().startsWith('bearer ')) {
      return hdr.slice(7).trim();
    }
    return undefined;
  }

  /** 不在此网关做 JWT：避免双网关重复校验/误断开；登记统一由 ChatGateway + PresenceService */
  async handleConnection() {}

  handleDisconnect(socket: Socket) {
    this.presence.untrackSocket(socket);
  }

  sendToUser(userId: number, data: unknown): boolean {
    return this.presence.emitToUser(userId, 'notification', data);
  }
}
