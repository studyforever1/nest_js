import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { RoleService } from '../role/role.service';
import * as bcrypt from 'bcryptjs';

interface FindUsersOptions {
  username?: string;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class UserService implements OnApplicationBootstrap {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly roleService: RoleService,
  ) {}

  /** 应用启动时，自动创建默认 admin */
  async onApplicationBootstrap() {
    const admin = await this.userRepo.findOne({ where: { username: 'admin' }, relations: ['roles'] });
    let adminRole = await this.roleService.findByName('admin');
    if (!adminRole) {
      adminRole = await this.roleService.createRole({ name: 'admin', description: '默认管理员角色' });
      console.log('默认角色已创建: admin');
    }
    if (!admin) {
      const hashed = await bcrypt.hash('admin123', 10);
      const newAdmin = this.userRepo.create({ username: 'admin', email: 'admin@example.com', password: hashed, roles: [adminRole] });
      await this.userRepo.save(newAdmin);
      console.log('默认管理员已创建: username=admin, password=admin123');
    }
  }

  /** 创建用户 */
  async create(data: Partial<User>): Promise<User> {
    const user = this.userRepo.create(data);
    return this.userRepo.save(user);
  }

  /** 根据用户名查找单个用户（可指定 select 和 relations） */
  async findByUsername(
    username: string,
    options?: { select?: (keyof User)[]; relations?: string[] },
  ): Promise<User | null> {
    const query = this.userRepo.createQueryBuilder('user').where('user.username = :username', { username });

    if (options?.select && options.select.length > 0) {
      query.select(options.select.map((f) => `user.${f}`));
    }

    if (options?.relations && options.relations.length > 0) {
      options.relations.forEach((rel) => query.leftJoinAndSelect(`user.${rel}`, rel));
    }

    return query.getOne();
  }

  /** 根据ID查找用户（包含角色） */
  async findById(userId: number): Promise<User | null> {
    return this.userRepo.findOne({ where: { user_id: userId }, relations: ['roles'] });
  }

  /** 删除用户（软删除） */
  async remove(userId: number): Promise<void> {
    await this.userRepo.softDelete(userId);
  }

  /** 分页 + 模糊搜索用户 */
  async findUsers(options: FindUsersOptions = {}) {
    const { username, page = 1, pageSize = 10 } = options;

    const query = this.userRepo
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.roles', 'role');

    if (username) {
      const kw = `%${username.toLowerCase()}%`;
      query.where('LOWER(user.username) LIKE :kw', { kw });
    }

    query.skip((page - 1) * pageSize).take(pageSize);

    const [users, total] = await query.getManyAndCount();

    return { data: users, total, page, pageSize };
  }
}
