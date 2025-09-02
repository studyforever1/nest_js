// src/users/user.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ApiResponse } from '../../common/response/response.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  /** 创建用户 */
  async create(dto: CreateUserDto): Promise<ApiResponse<User>> {
    const user = this.userRepo.create(dto);
    if (dto.password) {
      user.password = await bcrypt.hash(dto.password, 10);
    }
    const saved = await this.userRepo.save(user);
    return ApiResponse.success(saved, '用户创建成功');
  }

  /** 查询所有用户 */
  async findAll(): Promise<ApiResponse<User[]>> {
    const users = await this.userRepo.find({ relations: ['tasks'] });
    return ApiResponse.success(users, '获取用户列表成功');
  }

  /** 根据 ID 查询用户 */
  async findOne(id: number): Promise<ApiResponse<User>> {
    const user = await this.userRepo.findOne({
      where: { user_id: id  },
      relations: ['tasks'],
    });
    if (!user) throw new NotFoundException('用户不存在');
    return ApiResponse.success(user, '获取用户成功');
  }

  /** 更新用户 */
  async update(id: number, dto: UpdateUserDto): Promise<ApiResponse<User>> {
    const user = await this.userRepo.findOne({ where: { user_id: id  } });
    if (!user) throw new NotFoundException('用户不存在');

    if (dto.password) {
      dto.password = await bcrypt.hash(dto.password, 10);
    }

    Object.assign(user, dto);
    const updated = await this.userRepo.save(user);
    return ApiResponse.success(updated, '用户更新成功');
  }

  /** 删除用户 */
  async remove(id: number): Promise<ApiResponse<null>> {
    const user = await this.userRepo.findOne({ where: { user_id: id  } });
    if (!user) throw new NotFoundException('用户不存在');
    await this.userRepo.softDelete(id);
    return ApiResponse.success(null, '用户删除成功');
  }
}
