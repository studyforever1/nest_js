import { Injectable } from '@nestjs/common';
import { Repository, In } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { History } from './entities/history.entity';
import { User } from '../user/entities/user.entity';

@Injectable()
export class HistoryService {
  constructor(
    @InjectRepository(History)
    private readonly historyRepo: Repository<History>,
  ) {}

  /**
   * 获取指定用户的历史记录列表
   * @param user 用户实体
   * @param task_type 可选：任务类型
   */
  async list(user: User, task_type?: string): Promise<History[]> {
    const where: any = { user: { user_id: user.user_id } };
    if (task_type) where.task_type = task_type;

    return this.historyRepo.find({
      where,
      order: { created_at: 'DESC' },
    });
  }

  /**
   * 删除单条或多条历史记录，只能删除自己的
   * @param user 当前用户
   * @param ids 要删除的ID，数字或字符串，单个或数组
   */
  async delete(user: User, ids: number[] | string[] | number | string): Promise<{ deletedCount: number }> {
    const idArray = (Array.isArray(ids) ? ids : [ids]).map(id => Number(id));

    // 删除条件：ID 在数组中 && 属于当前用户
    const result = await this.historyRepo.delete({
      id: In(idArray),
      user: { user_id: user.user_id },
    });

    return { deletedCount: result.affected || 0 };
  }
}
