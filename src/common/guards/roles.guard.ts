import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<string[]>('roles', context.getHandler());
    if (!requiredRoles) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user; // JWT Strategy 已验证 user

    console.log('👤 当前用户:', user);
    console.log('🔑 需要的角色:', requiredRoles);

    if (!user || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException(`需要角色: ${requiredRoles}, 当前角色: ${user?.role}`);
    }

    return true;
  }
}
