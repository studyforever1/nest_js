import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { SharedData } from './entities/shared-data.entity';
import { Task } from '../../database/entities/task.entity';
import { User } from '../user/entities/user.entity';
import { ApiResponse } from '../../common/response/response.dto';

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

  /** 保存共享方案 */
  async saveShared(
    taskUuid: string,
    userId: number,
    schemeIds: string[],
  ): Promise<ApiResponse<{ count: number }>> {
    const task = await this.taskRepo.findOne({
      where: { task_uuid: taskUuid },
      relations: ['results'],
    });
    if (!task) return ApiResponse.error('任务不存在');

    const user = await this.userRepo.findOneBy({ user_id: userId });
    if (!user) return ApiResponse.error('用户不存在');

    const resultEntity = task.results?.[0];
    if (!resultEntity?.output_data) return ApiResponse.error('任务结果为空');

    const results = resultEntity.output_data;
    const sharedItems: SharedData[] = [];

    for (const item of results) {
      const seq = String(item['序号']);
      if (!schemeIds.includes(seq)) continue;

      const exists = await this.sharedRepo.findOne({
        where: { task: { task_uuid: task.task_uuid }, scheme_id: seq },
      });

      if (!exists) {
        sharedItems.push(
          this.sharedRepo.create({
            task,
            user,
            scheme_id: seq,
            result: item,
            module_type: task.module_type,
          }),
        );
      }
    }

    if (sharedItems.length) {
      await this.sharedRepo.save(sharedItems);
    }

    return ApiResponse.success({ count: sharedItems.length }, '共享方案保存成功');
  }

  /** 查询共享方案（按模块类型，可不区分用户） */
  /** 查询共享方案（按模块类型） */
async list(module_type?: string): Promise<ApiResponse<any[]>> {
  const where: any = {};
  if (module_type) where.module_type = module_type;

  const data = await this.sharedRepo.find({
    where,
    order: { created_at: 'DESC' },
    relations: ['user', 'task'], // 保留关系以防其他逻辑需要，但不返回给前端
  });

  // 格式化输出，只保留必要字段
  const formatted = data.map(item => ({
    id: item.id,
    scheme_id: item.scheme_id,
    result: item.result,
    module_type: item.module_type,
    created_at: item.created_at,
  }));

  return ApiResponse.success(formatted, '获取共享方案成功');
}


  /** 删除共享方案（可按ID删除） */
  async delete(ids: number[] | string[]): Promise<ApiResponse<{ count: number }>> {
    const result = await this.sharedRepo.delete({
      id: In(ids as any),
    });
    return ApiResponse.success({ count: result.affected || 0 }, '删除共享方案成功');
  }
}
