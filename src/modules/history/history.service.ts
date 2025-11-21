// src/modules/history/history.service.ts
import { Injectable } from '@nestjs/common';
import { Repository, In } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { History } from './entities/history.entity';
import { User } from '../user/entities/user.entity';
import { Task } from '../../database/entities/task.entity';
import { ApiResponse } from '../../common/response/response.dto';

@Injectable()
export class HistoryService {
  constructor(
    @InjectRepository(History)
    private readonly historyRepo: Repository<History>,
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
  ) {}

  /** 查询历史记录 */
  async list(user: User, module_type?: string): Promise<ApiResponse<History[]>> {
    const where: any = { user: { user_id: user.user_id } };
    if (module_type) where.module_type = module_type;

    const histories = await this.historyRepo.find({
      where,
      order: { created_at: 'DESC' },
    });

    return ApiResponse.success(histories, '获取历史记录成功');
  }

  /** 删除历史记录 */
  async delete(user: User, ids: number[] | string[] | number | string): Promise<ApiResponse<{ count: number }>> {
    const idArray = (Array.isArray(ids) ? ids : [ids]).map(id => Number(id));

    const result = await this.historyRepo.delete({
      id: In(idArray),
      user: { user_id: user.user_id },
    });

    return ApiResponse.success({ count: result.affected || 0 }, '删除历史记录成功');
  }

  /** 保存方案到历史记录 */
  // src/modules/history/history.service.ts
async saveBatch(
  user: User,
  task: Task,
  results: any[],
  schemeIndexes: number[],
  moduleType: string,
): Promise<ApiResponse<null>> {

  const histories: History[] = [];

  for (const index of schemeIndexes) {
    const scheme = results[index];
    if (!scheme) continue;

    const history = this.historyRepo.create({
      task,
      user,
      scheme_id: `${task.task_uuid}-${index}`,
      result: scheme,
      module_type: moduleType,
    });
    histories.push(history);
  }

  if (!histories.length) return ApiResponse.error('没有有效的方案可保存');

  await this.historyRepo.save(histories);

  return ApiResponse.success(null, '批量保存成功');
}

}
