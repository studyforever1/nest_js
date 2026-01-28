import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Department } from './entities/department.entity';
import { User } from '../user/entities/user.entity';

interface DepartmentQueryOptions {
  page: number;
  pageSize: number;
  keyword?: string;
}

/**
 * 部门服务类
 * 提供部门的增删改查、用户关联管理等功能
 */
@Injectable()
export class DepartmentService {
  constructor(
    @InjectRepository(Department)
    private readonly deptRepo: Repository<Department>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  /**
   * 创建部门
   * @param data 部门数据（名称、描述等）
   * @returns 创建的部门实体
   */
  async create(data: Partial<Department>) {
    const dept = this.deptRepo.create(data);
    return this.deptRepo.save(dept);
  }

  /**
   * 更新部门信息
   * @param id 部门ID
   * @param data 要更新的部门数据
   * @returns 更新后的部门实体
   * @throws NotFoundException 部门不存在时抛出
   */
  async update(id: number, data: Partial<Department>) {
    const dept = await this.deptRepo.findOne({ where: { id } });
    if (!dept) throw new NotFoundException('部门不存在');
    Object.assign(dept, data);
    return this.deptRepo.save(dept);
  }

async removeBatch(ids: number[]) {
  const depts = await this.deptRepo.find({
    where: { id: In(ids) },
  });

  if (depts.length === 0) {
    throw new NotFoundException('未找到可删除的部门');
  }

  // ⚠️ onDelete: SET NULL 会自动处理 user.department
  await this.deptRepo.remove(depts);

  return {
    deletedIds: depts.map((d) => d.id),
    count: depts.length,
  };
}

  /**
   * 根据ID查询单个部门
   * @param id 部门ID
   * @returns 部门实体
   * @throws NotFoundException 部门不存在时抛出
   */
  async findOne(id: number) {
    const dept = await this.deptRepo.findOne({ where: { id } });
    if (!dept) throw new NotFoundException('部门不存在');
    return dept;
  }

  /**
   * 分页查询部门列表
   * @param options 查询选项，包含页码、每页数量、关键字
   * @returns 分页结果，包含部门列表、总数、总页数等信息
   */
  async findAll(options: DepartmentQueryOptions) {
    const { page, pageSize, keyword } = options;
    const query = this.deptRepo.createQueryBuilder('dept')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .orderBy('dept.id', 'ASC');

    // 如果有关键字，按部门名称模糊搜索
    if (keyword) {
      query.where('dept.name LIKE :kw', { kw: `%${keyword}%` });
    }

    const [data, total] = await query.getManyAndCount();
    return {
      data,
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * 将用户添加到指定部门
   * 注意：一个用户只能属于一个部门，如果用户已有部门，此操作会覆盖原有部门
   * @param deptId 部门ID
   * @param userId 用户ID
   * @returns 更新后的用户实体
   * @throws NotFoundException 部门或用户不存在时抛出
   */
  async addUserToDepartment(deptId: number, userId: number) {
    const dept = await this.findOne(deptId);
    const user = await this.userRepo.findOne({ where: { user_id: userId, isDeleted: false } });
    if (!user) throw new NotFoundException('用户不存在');
    user.department = dept;
    await this.userRepo.save(user);
    return user;
  }

  /**
   * 将用户从部门中移除
   * @param deptId 部门ID
   * @param userId 用户ID
   * @returns 更新后的用户实体
   * @throws NotFoundException 用户不存在或用户不在此部门时抛出
   */
  async removeUserFromDepartment(deptId: number, userId: number) {
    const user = await this.userRepo.findOne({
      where: { user_id: userId, isDeleted: false },
      relations: ['department'],
    });
    if (!user) throw new NotFoundException('用户不存在');
    if (!user.department || user.department.id !== deptId) {
      throw new NotFoundException('该用户不在此部门中');
    }
    user.department = null;
    await this.userRepo.save(user);
    return user;
  }

  /**
   * 分页查询指定部门下的所有用户
   * @param deptId 部门ID
   * @param page 页码（从1开始）
   * @param pageSize 每页数量
   * @returns 包含部门信息、用户列表、分页信息的对象
   * @throws NotFoundException 部门不存在时抛出
   */
  async getUsersByDepartment(deptId: number, page: number, pageSize: number) {
    const dept = await this.findOne(deptId);

    const query = this.userRepo.createQueryBuilder('user')
      .leftJoinAndSelect('user.department', 'dept')
      .where('dept.id = :deptId', { deptId })
      .andWhere('user.isDeleted = :isDeleted', { isDeleted: false })
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .orderBy('user.user_id', 'ASC');

    const [data, total] = await query.getManyAndCount();
    return {
      department: dept,
      data,
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}

