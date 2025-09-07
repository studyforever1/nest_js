import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../modules/user/entities/user.entity';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions: string[] = this.reflector.get<string[]>('permissions', context.getHandler()) || [];
    if (!requiredPermissions.length) return true;

    const request = context.switchToHttp().getRequest();
    const userId = request.user?.user_id;
    if (!userId) throw new ForbiddenException('用户未登录');

    const user = await this.userRepo.findOne({
      where: { user_id: userId },
      relations: ['roles', 'roles.permissions'],
    });

    if (!user) throw new ForbiddenException('用户不存在');

    const userPermissions = user.roles.flatMap(role => role.permissions.map(p => p.code));
    const hasPermission = requiredPermissions.every(p => userPermissions.includes(p));

    if (!hasPermission) throw new ForbiddenException('权限不足');

    return true;
  }
}
