import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { Role } from '../role/entities/role.entity';
import { Department } from '../department/entities/department.entity';
import { ImService } from '../im/im.service';
import * as fs from 'fs';
import * as path from 'path';

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
    @InjectRepository(Department)
    private readonly deptRepo: Repository<Department>,
    private readonly imService: ImService,
  ) {}

  /**
   * 创建用户
   * @param data 用户数据，可包含 departmentId 用于指定部门
   * @returns 创建的用户实体
   * @throws NotFoundException 当指定的部门ID不存在时抛出
   */
  async create(data: Partial<User> & { departmentId?: number }) {
    const { departmentId, ...userData } = data;
    
    // 如果指定了部门ID，查找并验证部门实体
    let department: Department | null = null;
    if (departmentId) {
      department = await this.deptRepo.findOne({ where: { id: departmentId } });
      if (!department) {
        throw new NotFoundException(`部门ID ${departmentId} 不存在`);
      }
    }

    const user = this.userRepo.create({
      ...userData,
      department,
    });
    const savedUser = await this.userRepo.save(user);

    // 创建 IM 用户（如果配置了 IM 服务）
    try {
      await this.imService.createImUser(savedUser);
    } catch (err) {
      console.error('IM 用户创建失败:', err);
      throw new Error('IM 用户创建失败，请联系管理员');
    }

    return savedUser;
  }

  /**
   * 分页查询用户列表（支持关键字搜索）
   * 自动加载用户的角色和部门信息
   * @param options 查询选项（页码、每页数量、关键字）
   * @returns 分页结果，包含用户列表、总数、总页数等信息
   */
  async queryUsers(options: QueryUsersOptions) {
    const { page, pageSize, keyword } = options;
    const query = this.userRepo.createQueryBuilder('user')
      .leftJoinAndSelect('user.roles', 'role')
      .leftJoinAndSelect('user.department', 'department')
      .where('user.isDeleted = :isDeleted', { isDeleted: false })
      .skip((page - 1) * pageSize)
      .take(pageSize);

    // 如果有关键字，按用户名或姓名模糊搜索
    if (keyword) {
      query.andWhere(
        'LOWER(user.username) LIKE :kw OR LOWER(user.fullName) LIKE :kw',
        { kw: `%${keyword.toLowerCase()}%` },
      );
    }

    const [data, total] = await query.getManyAndCount();
    return { data, page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
  }

  /**
   * 根据ID查询用户详情
   * 自动加载用户的角色和部门信息
   * @param id 用户ID
   * @returns 用户实体
   * @throws NotFoundException 用户不存在时抛出
   */
  async findById(id: number) {
    const user = await this.userRepo.findOne({
      where: { user_id: id, isDeleted: false },
      relations: ['roles', 'department'],
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
      .andWhere('user.deleted_at IS NULL');

    if (options?.select) {
      query.select(options.select.map(f => `user.${f}`));
    }
    if (options?.relations?.length) {
      options.relations.forEach(rel => {
        query.leftJoinAndSelect(`user.${rel}`, rel);
      });
    }

    return query.getOne();
  }

  /**
   * 更新用户信息
   * 支持更新用户的基本信息、角色、部门等
   * @param id 用户ID
   * @param data 要更新的用户数据，可包含 departmentId 用于更新部门
   * @returns 更新后的用户实体
   * @throws NotFoundException 用户不存在或指定的部门ID不存在时抛出
   */
  async update(id: number, data: Partial<User> & { departmentId?: number }) {
    const user = await this.findById(id);

    // 处理角色更新
    if (data.roles) {
      user.roles = data.roles;
      delete data.roles;
    }

    // 处理部门更新
    if (data.departmentId !== undefined) {
      const { departmentId, ...restData } = data;
      if (departmentId === null || departmentId === 0) {
        // 设置为 null 或 0 表示移除部门关联
        user.department = null;
      } else {
        // 查找并验证部门实体
        const department = await this.deptRepo.findOne({ where: { id: departmentId } });
        if (!department) {
          throw new NotFoundException(`部门ID ${departmentId} 不存在`);
        }
        user.department = department;
      }
      Object.assign(user, restData);
    } else {
      // 如果没有指定 departmentId，保持原有部门不变
      Object.assign(user, data);
    }

    return this.userRepo.save(user);
  }

  /** 删除用户（软删除） */
  async remove(id: number) {
    const user = await this.findById(id);
    user.isDeleted = true;
    return this.userRepo.save(user);
  }

  /** 获取当前用户信息 */
  async getProfile(userId: number) {
    return this.findById(userId);
  }

  /** 更新当前用户个人信息 */
  async updateProfile(userId: number, data: Partial<User>) {
    const user = await this.findById(userId);
    const payload: Partial<User> = {
      fullName: data.fullName,
      email: data.email,
      phone: data.phone,
      avatarPath: data.avatarPath,
    };
    Object.assign(user, payload);
    return this.userRepo.save(user);
  }

  /**
   * 更新头像路径 + 自动删除旧头像（本地存储）
   * 返回 avatarUrl 可直接用于 Swagger 预览
   */
  async updateAvatar(userId: number, avatarPath: string) {
    if (!avatarPath) throw new BadRequestException('头像路径不能为空');

    const user = await this.findById(userId);
    const oldAvatar = user.avatarPath;

    // 删除旧头像文件
    if (oldAvatar && fs.existsSync(path.join(process.cwd(), oldAvatar))) {
      try {
        fs.unlinkSync(path.join(process.cwd(), oldAvatar));
      } catch (err) {
        console.warn('⚠️ 删除旧头像失败:', err);
      }
    }

    // 更新数据库
    user.avatarPath = avatarPath;
    await this.userRepo.save(user);

    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    return `${baseUrl}/${avatarPath.replace(/\\/g, '/')}`;
  }
}
