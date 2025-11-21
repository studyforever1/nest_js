// user/user.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { Role } from '../role/entities/role.entity';

interface QueryUsersOptions {
  page: number;
  pageSize: number;
  keyword?: string;
}

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
  ) {}

  /** 创建用户 */
  async create(data: Partial<User>) {
    const user = this.userRepo.create(data);
    return this.userRepo.save(user);
  }

  /** 分页 + 搜索用户 */
  async queryUsers(options: QueryUsersOptions) {
    const { page, pageSize, keyword } = options;

    const query = this.userRepo.createQueryBuilder('user')
      .leftJoinAndSelect('user.roles', 'role')
      .where('user.isDeleted = :isDeleted', { isDeleted: false })
      .skip((page - 1) * pageSize)
      .take(pageSize);

    if (keyword) {
      query.andWhere(
        'LOWER(user.username) LIKE :kw OR LOWER(user.fullName) LIKE :kw',
        { kw: `%${keyword.toLowerCase()}%` },
      );
    }

    const [data, total] = await query.getManyAndCount();

    return {
      data,
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize)
    };
  }

  /** 根据 ID 查询用户 */
  async findById(id: number) {
    const user = await this.userRepo.findOne({
      where: { user_id: id, isDeleted: false },
      relations: ['roles'],
    });
    if (!user) throw new NotFoundException('用户不存在');
    return user;
  }

  /** 根据用户名查找用户 */
  async findByUsername(
    username: string,
    options?: { select?: (keyof User)[]; relations?: string[] },
  ): Promise<User | null> {
    const query = this.userRepo.createQueryBuilder('user')
      .where('user.username = :username', { username })
      .andWhere('user.deleted_at IS NULL'); // 软删除过滤

    // 显式选择字段
    if (options?.select) {
      query.select(options.select.map(field => `user.${field}`));
    }

    // 加载关联
    if (options?.relations?.length) {
      options.relations.forEach(rel => {
        query.leftJoinAndSelect(`user.${rel}`, rel);
      });
    }

    return query.getOne();
  }

  /** 更新用户信息 */
  async update(id: number, data: Partial<User>) {
    const user = await this.findById(id);

    if (data.roles) {
      user.roles = data.roles;
      delete data.roles;
    }

    Object.assign(user, data);
    return this.userRepo.save(user);
  }

  /** 删除用户（软删除） */
  async remove(id: number) {
    const user = await this.findById(id);
    user.isDeleted = true; // 软删除
    return this.userRepo.save(user);
  }
}
