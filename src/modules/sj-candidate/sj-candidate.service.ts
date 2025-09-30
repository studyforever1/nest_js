import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

  /** 保存候选方案 */
  async saveCandidate(
    taskUuid: string,
    userId: number,
    schemeIds: string[],
  ): Promise<ApiResponse<{ count: number }>> {
    const task = await this.taskRepo.findOne({
      where: { task_uuid: taskUuid },
      relations: ['results', 'user'],
    });
    if (!task) return ApiResponse.error('任务不存在');

    const user = await this.userRepo.findOneBy({ user_id: userId });
    if (!user) return ApiResponse.error('用户不存在');

    const resultEntity = task.results?.[0];
    if (!resultEntity?.output_data) return ApiResponse.error('任务结果为空');

    const results = resultEntity.output_data;
    const candidates: SjCandidate[] = [];

    for (const item of results) {
      const seq = String(item['序号']);
      if (!schemeIds.includes(seq)) continue;

      const exists = await this.candidateRepo.findOne({
        where: { task: { task_uuid: task.task_uuid }, scheme_id: seq },
        relations: ['task'],
      });

      if (!exists) {
        candidates.push(
          this.candidateRepo.create({
            task,
            user,
            scheme_id: seq,
            result: item,
            module_type: task.module_type,
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
  async list(user: User, module_type?: string) {
    const where: any = { user: { user_id: user.user_id } };
    if (module_type) where.module_type = module_type;

    return this.candidateRepo.find({
      where,
      order: { created_at: 'DESC' },
    });
  }

  /** 删除候选方案 */
  async delete(user: User, ids: number[] | string[]) {
    const result = await this.candidateRepo.delete({
      id: ids as any,
      user: { user_id: user.user_id },
    });
    return { deletedCount: result.affected || 0 };
  }
}
