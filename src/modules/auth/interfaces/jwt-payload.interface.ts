// src/modules/auth/interfaces/jwt-payload.interface.ts
export interface JwtPayload {
  sub: number;        // 用户ID，对应 User.user_id
  username: string;   // 用户名
  roles?: string[];   // 可选：用户角色数组
}
