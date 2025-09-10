import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { RoleService } from '../role/role.service';
import * as bcrypt from 'bcrypt';
import { Role } from '../role/entities/role.entity';

@Injectable()
export class UserService implements OnApplicationBootstrap {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly roleService: RoleService,
  ) {}

  /** 应用启动时，自动创建默认 admin */
  async onApplicationBootstrap() {
    // 1️⃣ 查找 admin 用户
    const admin = await this.userRepo.findOne({
      where: { username: 'admin' },
      relations: ['roles'],
    });

    // 2️⃣ 查找 admin 角色
    let adminRole = await this.roleService.findByName('admin');
    if (!adminRole) {
      adminRole = await this.roleService.createRole({
        name: 'admin',
        description: '默认管理员角色',
      });
      console.log('默认角色已创建: admin');
    }

    // 3️⃣ 如果 admin 用户不存在，就创建
    if (!admin) {
      const hashed = await bcrypt.hash('admin123', 10);
      const newAdmin = this.userRepo.create({
        username: 'admin',
        email: 'admin@example.com',
        password: hashed,
        roles: [adminRole], // 这里是实体数组
      });
      await this.userRepo.save(newAdmin);
      console.log('默认管理员已创建: username=admin, password=admin123');
    }
  }

  /** 创建用户 */
  async create(data: Partial<User>): Promise<User> {
    const user = this.userRepo.create(data);
    return this.userRepo.save(user);
  }

  /** 根据用户名查找 */
  async findByUsername(
    username: string,
    options?: { select?: (keyof User)[]; relations?: string[] },
  ): Promise<User | null> {
    const query = this.userRepo.createQueryBuilder('user')
      .where('user.username = :username', { username });

    if (options?.select && options.select.length > 0) {
      query.select(options.select.map((f) => `user.${f}`));
    }

    if (options?.relations && options.relations.length > 0) {
      options.relations.forEach((rel) =>
        query.leftJoinAndSelect(`user.${rel}`, rel),
      );
    }

    return query.getOne();
  }

  /** 根据ID查找 */
  async findById(userId: number): Promise<User | null> {
    return this.userRepo.findOne({
      where: { user_id: userId },
      relations: ['roles'],
    });
  }

  /** 通用查找（兼容 chat 模块调用） */
  async findOne(userId: number, withRelations = false): Promise<User | null> {
    return this.userRepo.findOne({
      where: { user_id: userId },
      relations: withRelations ? ['roles'] : [],
    });
  }

  /** 获取所有用户 */
  async findAll(): Promise<User[]> {
    return this.userRepo.find({ relations: ['roles'] });
  }

  /** 删除用户（软删除） */
  async remove(userId: number): Promise<void> {
    await this.userRepo.softDelete(userId);
  }
}
