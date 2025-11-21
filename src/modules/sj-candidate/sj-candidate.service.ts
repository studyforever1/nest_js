import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { SjCandidate } from './entities/sj-candidate.entity';
import { Task } from '../../database/entities/task.entity';
import { User } from '../user/entities/user.entity';
import { ApiResponse } from '../../common/response/response.dto';

@Injectable()
export class SjCandidateService {
  constructor(
    @InjectRepository(SjCandidate)
    private readonly candidateRepo: Repository<SjCandidate>,
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  /** 批量保存候选方案 */
  async saveCandidate(
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

    const resultEntity = task.results?.[0];
    if (!resultEntity?.output_data) return ApiResponse.error('任务结果为空');

    let results = resultEntity.output_data;
    if (typeof results === 'string') {
      try {
        results = JSON.parse(results);
      } catch (e) {
        return ApiResponse.error('任务结果 JSON 解析失败');
      }
    }

    const candidates: SjCandidate[] = [];

    for (const index of schemeIndexes) {
      const scheme = results[index];
      if (!scheme) continue;

      const exists = await this.candidateRepo.findOne({
        where: { task: { task_uuid: task.task_uuid }, scheme_id: `${task.task_uuid}-${index}` },
      });

      if (!exists) {
        candidates.push(
          this.candidateRepo.create({
            task,
            user,
            scheme_id: `${task.task_uuid}-${index}`,
            result: scheme,
            module_type: moduleType,
          }),
        );
      }
    }

    if (candidates.length) {
      await this.candidateRepo.save(candidates);
    }

    return ApiResponse.success({ count: candidates.length }, '候选方案保存成功');
  }

  /** 查询候选方案 */
  async list(user: User, module_type?: string): Promise<ApiResponse<any[]>> {
    const where: any = { user: { user_id: user.user_id } };
    if (module_type) where.module_type = module_type;

    const data = await this.candidateRepo.find({
      where,
      order: { created_at: 'DESC' },
    });

    const formatted = data.map(item => ({
      id: item.id,
      scheme_id: item.scheme_id,
      result: item.result,
      module_type: item.module_type,
      created_at: item.created_at,
    }));

    return ApiResponse.success(formatted, '获取候选方案成功');
  }

  /** 删除候选方案 */
  async delete(user: User, ids: number[] | string[]): Promise<ApiResponse<{ count: number }>> {
    const idArray = Array.isArray(ids) ? ids : [ids];

    const result = await this.candidateRepo.delete({
      id: In(idArray as any),
      user: { user_id: user.user_id },
    });

    return ApiResponse.success({ count: result.affected || 0 }, '删除候选方案成功');
  }
}
