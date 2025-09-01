import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {}

  /** 创建用户 */
  async create(dto: CreateUserDto): Promise<User> {
    const user = this.userRepo.create(dto);
    if (dto.password) {
      user.password = await bcrypt.hash(dto.password, 10);
    }
    return this.userRepo.save(user);
  }

  /** 查询所有用户（分页可扩展） */
  async findAll(): Promise<User[]> {
    return this.userRepo.find({
      relations: ['tasks'], // 查询时加载任务
    });
  }

  /** 根据 ID 查询用户 */
  async findOne(id: number): Promise<User> {
    const user = await this.userRepo.findOne({
      where: { user_id: id },
      relations: ['tasks'],
    });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  /** 更新用户 */
  async update(id: number, dto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);
    if (dto.password) {
      dto.password = await bcrypt.hash(dto.password, 10);
    }
    Object.assign(user, dto);
    return this.userRepo.save(user);
  }

  /** 软删除用户 */
  async remove(id: number): Promise<void> {
    await this.userRepo.softDelete(id);
  }
}
