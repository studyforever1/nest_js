// src/modules/history/history.service.ts
import { Injectable } from '@nestjs/common';
import { Repository, In,Between } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { History } from './entities/history.entity';
import { User } from '../user/entities/user.entity';
import { Task } from '../../database/entities/task.entity';
import { ApiResponse } from '../../common/response/response.dto';
import { ListHistoryDto } from './dto/list-history.dto';
import dayjs from 'dayjs';


@Injectable()
export class HistoryService {
  constructor(
    @InjectRepository(History)
    private readonly historyRepo: Repository<History>,
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
  ) {}
private formatRaw = (item: History) => {
  return {
    id: item.id,
    scheme_id: item.scheme_id,
    module_type: item.module_type,
    result: item.result,
    created_at: dayjs(item.created_at).format('YYYY-MM-DD HH:mm:ss'),
  };
};

  
  /** 查询历史记录 */
  async list(user: User, query: ListHistoryDto) {
    const {
      module_type,
      date,
      page = 1,
      pageSize = 10,
    } = query;

    const where: any = {
      user: { user_id: user.user_id },
    };

    if (module_type) where.module_type = module_type;

    // === 只筛选当天（如 YYYY-MM-DD） ===
    if (date) {
      const start = new Date(`${date} 00:00:00`);
      const end = new Date(`${date} 23:59:59`);
      where.created_at = Between(start, end);
    }

    const [records, total] = await this.historyRepo.findAndCount({
      where,
      order: { created_at: 'DESC' },
      skip: (Number(page) - 1) * Number(pageSize),
      take: Number(pageSize),
    });

    return ApiResponse.success(
      {
        data: records.map(this.formatRaw),
        total,
        page: Number(page),
        pageSize: Number(pageSize),
        totalPages: Math.ceil(total / pageSize)
      },
      '获取历史记录成功',
    );
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
 /** 保存方案到历史记录 */
// src/modules/history/history.service.ts
async saveBatch(
  user: User,
  task: Task,
  results: any[],
  schemeIndexes: number[],
  moduleType: string,
): Promise<ApiResponse<{ count: number }>> {
  const histories: History[] = [];

  for (const index of schemeIndexes) {
    const scheme = results[index];
    if (!scheme) continue;

    // 检查是否已存在
    const exists = await this.historyRepo.findOne({
      where: { task: { task_uuid: task.task_uuid }, scheme_id: `${task.task_uuid}-${index}` },
    });

    if (!exists) {
      const history = this.historyRepo.create({
        task,
        user,
        scheme_id: `${task.task_uuid}-${index}`,
        result: scheme,
        module_type: moduleType,
      });
      histories.push(history);
    }
  }

  if (!histories.length) return ApiResponse.error('没有有效的方案可保存');

  await this.historyRepo.save(histories);

  return ApiResponse.success(
    { count: histories.length },
    '方案保存成功',
  );
}


}
