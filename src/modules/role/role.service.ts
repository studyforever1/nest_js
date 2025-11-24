// src/modules/role/role.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Role } from './entities/role.entity';
import { Menu } from '../menu/entity/menu.entity';

import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Injectable()
export class RoleService {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,

    @InjectRepository(Menu)
    private readonly menuRepo: Repository<Menu>,
  ) { }

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

  /** 新建角色 */
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

  /** 删除角色 */
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

  /** 给角色分配菜单 */
  async assignMenusToRole(roleCode: string, menuIds: number[]) {
  const role = await this.roleRepo.findOne({
    where: { roleCode },
    relations: ['menus'],
  });

  if (!role) throw new NotFoundException(`角色不存在：${roleCode}`);

  const menus = await this.menuRepo.find({
    where: { id: In(menuIds) },
  });

  if (!menus.length) throw new BadRequestException('菜单不存在');

  // 清空旧关联
  role.menus = [];
  await this.roleRepo.save(role);

  // 重新关联
  role.menus = menus;
  const savedRole = await this.roleRepo.save(role);

  return savedRole;
}


  /** 查询角色菜单 */
  async getRoleMenus(roleCode: string) {
    const role = await this.roleRepo.findOne({
      where: { roleCode },
      relations: ['menus'],
    });

    if (!role) throw new NotFoundException(`角色不存在：${roleCode}`);

    return role.menus;
  }
  /** 根据 roleCode 数组查找 Role 实体 */
  async findByCodes(codes: string[]): Promise<Role[]> {
    if (!codes || codes.length === 0) return [];

    const roles = await this.roleRepo.find({
      where: { roleCode: In(codes) },
      relations: ['menus'], // 加载菜单关系
    });

    if (!roles || roles.length === 0) {
      throw new NotFoundException(`未找到角色: ${codes.join(',')}`);
    }

    return roles;
  }

  /** 根据单个 roleCode 查找 */
  async findByCode(code: string): Promise<Role> {
    const role = await this.roleRepo.findOne({
      where: { roleCode: code },
      relations: ['menus'],
    });
    if (!role) throw new NotFoundException(`未找到角色: ${code}`);
    return role;
  }
}
