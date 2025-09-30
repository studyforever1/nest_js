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
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  /**
   * 获取指定用户的历史记录列表
   * @param user 用户实体
   * @param task_type 可选：任务类型
   */
  async list(user: User, task_type?: string): Promise<ApiResponse<History[]>> {
    const where: any = { user: { user_id: user.user_id } };
    if (task_type) where.module_type = task_type;

    const histories = await this.historyRepo.find({
      where,
      order: { created_at: 'DESC' },
    });

    return ApiResponse.success(histories, '获取历史记录成功');
  }

  /**
   * 删除单条或多条历史记录，只能删除自己的
   * @param user 当前用户
   * @param ids 要删除的ID，数字或字符串，单个或数组
   */
  async delete(user: User, ids: number[] | string[] | number | string): Promise<ApiResponse<{ count: number }>> {
    const idArray = (Array.isArray(ids) ? ids : [ids]).map(id => Number(id));

    const result = await this.historyRepo.delete({
      id: In(idArray),
      user: { user_id: user.user_id },
    });

    return ApiResponse.success({ count: result.affected || 0 }, '删除历史记录成功');
  }

  /**
   * 保存用户选择的方案到历史记录
   * @param user 用户实体
   * @param task 任务实体
   * @param results 计算结果数组
   * @param schemeIds 用户选择的方案序号
   */
  async save(user: User, task: Task, results: any[], schemeIds: string[]): Promise<ApiResponse<{ count: number }>> {
    const histories: History[] = [];

    for (const item of results) {
      const seq = String(item['序号']);
      if (!schemeIds.includes(seq)) continue;

      // 去重检查
      const exists = await this.historyRepo.findOne({
        where: { task: { task_uuid: task.task_uuid }, scheme_id: seq },
        relations: ['task'],
      });

      if (!exists) {
        histories.push(
          this.historyRepo.create({
            task,
            user,
            scheme_id: seq,
            result: item,
            module_type: task.module_type,
          }),
        );
      }
    }

    if (histories.length) {
      await this.historyRepo.save(histories);
    }

    return ApiResponse.success({ count: histories.length }, '历史方案保存成功');
  }
}
