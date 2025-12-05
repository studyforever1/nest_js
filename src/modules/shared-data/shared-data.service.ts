// src/modules/shared-data/shared-data.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Between } from 'typeorm';
import { SharedData } from './entities/shared-data.entity';
import { Task } from '../../database/entities/task.entity';
import { User } from '../user/entities/user.entity';
import { ApiResponse } from '../../common/response/response.dto';
import dayjs from 'dayjs';
import { ListSharedDto } from './dto/list-shared.dto';

@Injectable()
export class SharedDataService {
  constructor(
    @InjectRepository(SharedData)
    private readonly sharedRepo: Repository<SharedData>,
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  /** ----------- 统一格式（完全对齐 History） ----------- */
  private formatRaw = (item: SharedData) => {
    return {
      id: item.id,
      scheme_id: item.scheme_id,
      module_type: item.module_type,
      result: item.result,
      created_at: dayjs(item.created_at).format('YYYY-MM-DD HH:mm:ss'),
      task_uuid: item.task?.task_uuid || null,
      username: item.user?.username || null,
    };
  };

  /** ----------- 批量保存共享方案 ----------- */
  async saveShared(
    taskUuid: string,
    userId: number,
    schemeIndexes: number[],
    moduleType: string,
  ): Promise<ApiResponse<{ count: number }>> {
    const task = await this.taskRepo.findOne({
      where: { task_uuid: taskUuid },
      relations: ['results'],
    });
    if (!task) return ApiResponse.error('任务不存在');

    const user = await this.userRepo.findOneBy({ user_id: userId });
    if (!user) return ApiResponse.error('用户不存在');

    let results = task.results?.[0]?.output_data;
    if (!results) return ApiResponse.error('任务结果为空');

    if (typeof results === 'string') {
      try {
        results = JSON.parse(results);
      } catch {
        return ApiResponse.error('任务结果 JSON 解析失败');
      }
    }

    const sharedItems: SharedData[] = [];

    for (const index of schemeIndexes) {
      const scheme = results[index];
      if (!scheme) continue;

      const exists = await this.sharedRepo.findOne({
        where: { task: { task_uuid: task.task_uuid }, scheme_id: `${task.task_uuid}-${index}` },
      });

      if (!exists) {
        sharedItems.push(
          this.sharedRepo.create({
            task,
            user,
            scheme_id: `${task.task_uuid}-${index}`,
            result: scheme,
            module_type: moduleType,
          }),
        );
      }
    }

    if (sharedItems.length) {
      await this.sharedRepo.save(sharedItems);
    }

    return ApiResponse.success(
      { count: sharedItems.length },
      '共享方案保存成功',
    );
  }

  /** ----------- 分页查询（完全对齐 History） ----------- */
  async list(user: User, query: ListSharedDto) {
    const { module_type, date, page = 1, pageSize = 10 } = query;

    const where: any = {
      user: { user_id: user.user_id },
    };

    if (module_type) where.module_type = module_type;

    // === 日期筛选（YYYY-MM-DD） ===
    if (date) {
      const start = new Date(`${date} 00:00:00`);
      const end = new Date(`${date} 23:59:59`);
      where.created_at = Between(start, end);
    }

    const [records, total] = await this.sharedRepo.findAndCount({
      where,
      relations: ['task', 'user'],
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
        totalPages: Math.ceil(total / pageSize),
      },
      '获取共享记录成功',
    );
  }

  /** ----------- 删除共享记录（对齐 History） ----------- */
  async delete(ids: number[] | string[]): Promise<ApiResponse<{ count: number }>> {
    const idArray = (Array.isArray(ids) ? ids : [ids]).map(Number);

    const result = await this.sharedRepo.delete({
      id: In(idArray),
    });

    return ApiResponse.success(
      { count: result.affected || 0 },
      '删除共享记录成功',
    );
  }
}
