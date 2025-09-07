import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Role } from './entities/role.entity';
import { Permission } from '../permission/entities/permission.entity';

@Injectable()
export class RoleService {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    @InjectRepository(Permission)
    private readonly permissionRepo: Repository<Permission>,
  ) {}

  /** 根据单个角色名查找角色 */
  async findByName(name: string): Promise<Role | null> {
    return this.roleRepo.findOne({ where: { name } });
  }

  /** 根据多个角色名查找角色数组 */
  async findByNames(names: string[]): Promise<Role[]> {
    return this.roleRepo.find({
      where: { name: In(names) },
    });
  }

  /** 创建角色 */
  async createRole(data: Partial<Role>): Promise<Role> {
    const role = this.roleRepo.create(data);
    return this.roleRepo.save(role);
  }

  /** 给角色分配权限 */
  async assignPermissionsToRole(roleCode: string, permissionCodes: string[]) {
  console.log('assignPermissionsToRole', roleCode, permissionCodes);

  const role = await this.roleRepo.findOne({
    where: { name: roleCode },
    relations: ['permissions'],
  });
  if (!role) {
    console.error('角色不存在:', roleCode);
    throw new NotFoundException(`角色不存在: ${roleCode}`);
  }

  const permissions = await this.permissionRepo.findBy({
    code: In(permissionCodes),
  });
  console.log('找到的权限:', permissions);

  if (!permissions.length) {
    console.error('权限不存在:', permissionCodes);
    throw new BadRequestException(`未找到对应权限: ${permissionCodes.join(', ')}`);
  }

  role.permissions = permissions;

  try {
    const savedRole = await this.roleRepo.save(role);
    console.log('分配权限成功', savedRole);
    return savedRole;
  } catch (error) {
    console.error('保存角色权限失败', error);
    throw error;
  }
}


  /** 查询角色权限 */
  async getRolePermissions(roleCode: string) {
    const role = await this.roleRepo.findOne({
      where: { name: roleCode },
      relations: ['permissions'],
    });
    if (!role) throw new NotFoundException(`角色不存在: ${roleCode}`);
    return role.permissions;
  }
}
