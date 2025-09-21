import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../../modules/role/entities/role.entity';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<string[]>(
      'roles',
      context.getHandler(),
    );
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user; // JWT Strategy 已验证 user

    console.log('👤 当前用户:', user);
    console.log('🔑 需要的角色:', requiredRoles);

    if (!user || !user.roles || user.roles.length === 0) {
      throw new ForbiddenException(`需要角色: ${requiredRoles}, 当前没有角色`);
    }

    // user.roles 是 Role[]，取 name 比较
    const userRoleNames = user.roles.map((r: Role) => r.name);

    const hasRole = requiredRoles.some((role) => userRoleNames.includes(role));

    if (!hasRole) {
      throw new ForbiddenException(
        `需要角色: ${requiredRoles}, 当前角色: ${userRoleNames}`,
      );
    }

    return true;
  }
}
