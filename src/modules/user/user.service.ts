import { Injectable, OnApplicationBootstrap  } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
@Injectable()
export class UserService implements OnApplicationBootstrap {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async onApplicationBootstrap() {
    const admin = await this.userRepo.findOne({ where: { role: 'admin' } });
    if (!admin) {
      const hashed = await bcrypt.hash('admin123', 10);
      await this.userRepo.save({
        username: 'admin',
        email: 'admin@example.com',
        password: hashed,
        role: 'admin',
      });
      console.log('默认管理员已创建: username=admin, password=admin123');
    }
  }


  /** 创建用户 */
  async create(data: Partial<User>): Promise<User> {
    const user = this.userRepo.create(data);
    return this.userRepo.save(user);
  }

  /** 根据用户名查找 */
  async findByUsername(username: string, selectFields: (keyof User)[] = []): Promise<User | null> {
    const query = this.userRepo.createQueryBuilder('user')
      .where('user.username = :username', { username });
    // 如果指定了选择字段
    if (selectFields.length > 0) {
      query.select(selectFields.map(f => `user.${f}`));
    }
    return query.getOne();
  }


  /** 根据ID查找 */
  async findById(userId: number): Promise<User | null> {
    return this.userRepo.findOne({ where: { user_id: userId } });
  }

  /** 获取所有用户 */
  async findAll(): Promise<User[]> {
    return this.userRepo.find();
  }

  /** 删除用户（软删除） */
  async remove(userId: number): Promise<void> {
    await this.userRepo.softDelete(userId);
  }
}
