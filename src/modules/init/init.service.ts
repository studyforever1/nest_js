import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '../user/entities/user.entity';
import { Role } from '../role/entities/role.entity';

@Injectable()
export class InitService implements OnApplicationBootstrap {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
  ) {}

  async onApplicationBootstrap() {
    await this.createAdminRole();
    await this.createDefaultAdmin();
  }

  /** 创建 admin 角色（使用 roleCode） */
  private async createAdminRole() {
    const existingRole = await this.roleRepo.findOne({ where: { roleCode: 'admin' } });
    if (!existingRole) {
      const role = this.roleRepo.create({
        roleCode: 'admin',        // 唯一标识
        roleName: '系统管理员',     // 显示名称
        description: '系统默认管理员',
      });
      await this.roleRepo.save(role);
      Logger.log('✅ admin 角色已创建');
    } else {
      Logger.log('ℹ️ admin 角色已存在');
    }
  }

  /** 创建默认管理员用户 */
  private async createDefaultAdmin() {
    const adminRole = await this.roleRepo.findOne({ where: { roleCode: 'admin' } });
    if (!adminRole) {
      Logger.warn('❌ 未找到 admin 角色，无法创建默认管理员');
      return;
    }

    const existingAdmin = await this.userRepo.findOne({ where: { username: 'admin' }, relations: ['roles'] });
    if (!existingAdmin) {
      const admin = this.userRepo.create({
        username: 'admin',
        password: await bcrypt.hash('admin123', 10),
        roles: [adminRole],
      });
      await this.userRepo.save(admin);
      Logger.log('✅ 默认管理员已创建：用户名 admin / 密码 admin123');
    } else {
      Logger.log('ℹ️ 默认管理员已存在');
    }
  }
}