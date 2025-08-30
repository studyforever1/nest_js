import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private reflector: Reflector, private jwtService: JwtService) {}
  canActivate(context: ExecutionContext): boolean {
    // 可实现 token 验证逻辑
    return true;
  }
}
