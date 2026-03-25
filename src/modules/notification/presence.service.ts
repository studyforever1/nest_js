import { Injectable } from '@nestjs/common';
import { Socket } from 'socket.io';

/** WebSocket 登记 + HTTP 心跳合并，用于「谁在线」检测与通知推送 */
@Injectable()
export class PresenceService {
  /** 最近 HTTP 心跳有效时长 */
  private static readonly HTTP_PING_TTL_MS = 90_000;

  private readonly socketsByUser = new Map<number, Set<Socket>>();
  private readonly lastHttpPing = new Map<number, number>();

  private normalizeUserId(raw: unknown): number | null {
    if (raw === undefined || raw === null || raw === '') {
      return null;
    }
    const n = typeof raw === 'number' ? raw : Number(raw);
    return Number.isFinite(n) ? n : null;
  }

  /** Socket 连接成功（由 ChatGateway 在 JWT 校验通过后调用） */
  trackSocket(userId: number, socket: Socket): void {
    const uid = this.normalizeUserId(userId);
    if (uid === null) {
      return;
    }
    if (!this.socketsByUser.has(uid)) {
      this.socketsByUser.set(uid, new Set());
    }
    this.socketsByUser.get(uid)!.add(socket);
    console.log(`[在线] WebSocket 已登记 userId=${uid}，该用户当前连接数=${this.socketsByUser.get(uid)!.size}`);
  }

  /** 断开时移除（可多网关各调一次，幂等） */
  untrackSocket(socket: Socket): void {
    const uid = this.normalizeUserId(socket.data?.userId);
    if (uid === null) {
      return;
    }
    const set = this.socketsByUser.get(uid);
    if (!set) {
      return;
    }
    set.delete(socket);
    if (set.size === 0) {
      this.socketsByUser.delete(uid);
    }
    console.log(`[在线] WebSocket 已移除 userId=${uid}`);
  }

  emitToUser(userId: number, event: string, payload: unknown): boolean {
    const uid = this.normalizeUserId(userId);
    if (uid === null) {
      return false;
    }
    const set = this.socketsByUser.get(uid);
    if (!set || set.size === 0) {
      return false;
    }
    let any = false;
    for (const s of set) {
      if (s.connected) {
        s.emit(event, payload);
        any = true;
      }
    }
    return any;
  }

  recordHttpPing(userId: number): void {
    const uid = this.normalizeUserId(userId);
    if (uid === null) {
      return;
    }
    this.lastHttpPing.set(uid, Date.now());
  }

  getSocketOnlineUserIds(): number[] {
    return [...this.socketsByUser.keys()].sort((a, b) => a - b);
  }

  /** 合并：当前仍有 WebSocket 或在 TTL 内打过 HTTP 心跳的用户 */
  getMergedOnlineUserIds(): number[] {
    const now = Date.now();
    const merged = new Set<number>();
    for (const id of this.socketsByUser.keys()) {
      merged.add(id);
    }
    for (const [id, t] of this.lastHttpPing) {
      if (now - t <= PresenceService.HTTP_PING_TTL_MS) {
        merged.add(id);
      }
    }
    return [...merged].sort((a, b) => a - b);
  }

  getSnapshot() {
    const now = Date.now();
    const recentPingUserIds = [...this.lastHttpPing.entries()]
      .filter(([, t]) => now - t <= PresenceService.HTTP_PING_TTL_MS)
      .map(([id]) => id)
      .sort((a, b) => a - b);
    const socketUserIds = this.getSocketOnlineUserIds();
    return {
      userIds: this.getMergedOnlineUserIds(),
      socketConnectedUserIds: socketUserIds,
      recentHttpPingUserIds: recentPingUserIds,
      socketConnectionCount: socketUserIds.length,
      httpPingTtlSeconds: PresenceService.HTTP_PING_TTL_MS / 1000,
    };
  }
}
