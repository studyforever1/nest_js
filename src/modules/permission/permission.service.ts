// src/modules/permission/permission.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Like } from 'typeorm';
import { Permission } from './entities/permission.entity';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';

@Injectable()
export class PermissionService {
  constructor(
    @InjectRepository(Permission)
    private readonly permissionRepo: Repository<Permission>,
  ) {}

  /** 分页 + 搜索 */
  async findAll(query: { page?: number; pageSize?: number; keyword?: string }) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;

    const qb = this.permissionRepo
      .createQueryBuilder('permission')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .orderBy('permission.created_at', 'DESC');

    if (query.keyword) {
      qb.where(
        'permission.permissionCode LIKE :kw OR permission.permissionName LIKE :kw OR permission.description LIKE :kw',
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

  /** 创建 */
  async create(dto: CreatePermissionDto) {
    const exist = await this.permissionRepo.findOne({ where: { permissionCode: dto.permissionCode } });
    if (exist) throw new BadRequestException('权限编码已存在');

    const permission = this.permissionRepo.create(dto);
    return this.permissionRepo.save(permission);
  }

  /** 更新 */
  async update(id: number, dto: UpdatePermissionDto) {
    const permission = await this.permissionRepo.findOne({ where: { permission_id: id } });
    if (!permission) throw new NotFoundException('权限不存在');

    Object.assign(permission, dto);
    return this.permissionRepo.save(permission);
  }

  /** 删除（支持批量） */
  async remove(ids: number[]) {
    const permissions = await this.permissionRepo.find({ where: { permission_id: In(ids) } });
    if (!permissions.length) throw new BadRequestException('权限不存在');

    await this.permissionRepo.remove(permissions);
    return { success: true };
  }

  /** 根据编码查找单个权限 */
  async findByCode(code: string): Promise<Permission | null> {
    return this.permissionRepo.findOne({ where: { permissionCode: code } });
  }

  /** 批量查找权限 */
  async findByCodes(codes: string[]): Promise<Permission[]> {
    return this.permissionRepo.find({ where: { permissionCode: In(codes) } });
  }
}
