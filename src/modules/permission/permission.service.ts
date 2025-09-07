import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Permission } from './entities/permission.entity';

@Injectable()
export class PermissionService {
  constructor(
    @InjectRepository(Permission)
    private readonly permissionRepo: Repository<Permission>,
  ) {}

  async findByCode(code: string): Promise<Permission | null> {
    return this.permissionRepo.findOne({ where: { code } });
  }

  async findByCodes(codes: string[]): Promise<Permission[]> {
    return this.permissionRepo.find({ where: { code: In(codes) } });
  }

  async createPermission(data: Partial<Permission>): Promise<Permission> {
    const permission = this.permissionRepo.create(data);
    return this.permissionRepo.save(permission);
  }
}
