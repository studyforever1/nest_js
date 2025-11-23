// src/modules/role/role.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Role } from './entities/role.entity';
import { Permission } from '../permission/entities/permission.entity';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Injectable()
export class RoleService {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    @InjectRepository(Permission)
    private readonly permissionRepo: Repository<Permission>,
  ) {}

  /** 角色列表 + 搜索 + 分页 */
  async findAll(query: { page?: number; pageSize?: number; keyword?: string }) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;

    const qb = this.roleRepo
      .createQueryBuilder('role')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .orderBy('role.created_at', 'DESC');

    if (query.keyword) {
      qb.where(
        'role.roleCode LIKE :kw OR role.roleName LIKE :kw OR role.description LIKE :kw',
        { kw: `%${query.keyword}%` },
      );
    }

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /** 创建角色 */
  async create(dto: CreateRoleDto) {
    const exist = await this.roleRepo.findOne({
      where: { roleCode: dto.roleCode },
    });
    if (exist) throw new BadRequestException('角色编码已存在');

    const role = this.roleRepo.create(dto);
    return this.roleRepo.save(role);
  }

  /** 更新角色 */
async update(id: number, dto: UpdateRoleDto) {
  const role = await this.roleRepo.findOne({ where: { role_id: id } });
  if (!role) throw new NotFoundException('角色不存在');

  Object.assign(role, dto);
  return this.roleRepo.save(role);
}


  /** 删除角色（支持批量） */
  async remove(roleIds: number[]) {
    const roles = await this.roleRepo.find({
      where: { role_id: In(roleIds) },
    });

    if (!roles.length) {
      throw new BadRequestException('要删除的角色不存在');
    }

    await this.roleRepo.remove(roles);
    return { success: true };
  }

  /** 通过编码查找角色 */
  async findByCode(roleCode: string): Promise<Role | null> {
    return this.roleRepo.findOne({ where: { roleCode } });
  }

  /** 批量查找角色（编码） */
  async findByCodes(codes: string[]): Promise<Role[]> {
    return this.roleRepo.find({
      where: { roleCode: In(codes) },
    });
  }

  /** 分配权限 */
  async assignPermissionsToRole(roleCode: string, permissionCodes: string[]) {
    const role = await this.roleRepo.findOne({
      where: { roleCode },
      relations: ['permissions'],
    });

    if (!role) throw new NotFoundException(`角色不存在: ${roleCode}`);

    const permissions = await this.permissionRepo.find({
      where: { permissionCode: In(permissionCodes) },
    });

    if (!permissions.length) {
      throw new BadRequestException(`权限不存在: ${permissionCodes.join(', ')}`);
    }

    role.permissions = permissions;
    return this.roleRepo.save(role);
  }

  /** 查询角色权限 */
  async getRolePermissions(roleCode: string) {
    const role = await this.roleRepo.findOne({
      where: { roleCode },
      relations: ['permissions'],
    });

    if (!role) throw new NotFoundException(`角色不存在: ${roleCode}`);

    return role.permissions;
  }
  
}
