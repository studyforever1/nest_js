// src/modules/sj-candidate/sj-candidate.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Between } from 'typeorm';
import { SjCandidate } from './entities/sj-candidate.entity';
import { Task } from '../../database/entities/task.entity';
import { User } from '../user/entities/user.entity';
import { ApiResponse } from '../../common/response/response.dto';
import { ListCandidateDto } from './dto/list-candidate.dto';
import dayjs from 'dayjs';

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

  /** ----------- 统一格式方法（对齐 Shared / History） ----------- */
  private formatRaw = (item: SjCandidate) => {
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

  /** ----------- 批量保存候选方案 ----------- */
async saveCandidate(
  taskUuid: string,
  userId: number,
  schemeIndexes: number[], // 这里是方案序号数组
  moduleType: string,
) {
  // 1️⃣ 查任务
  const task = await this.taskRepo.findOne({
    where: { task_uuid: taskUuid },
    relations: ['results'],
  });
  if (!task) return ApiResponse.error('任务不存在');

  // 2️⃣ 查用户
  const user = await this.userRepo.findOneBy({ user_id: userId });
  if (!user) return ApiResponse.error('用户不存在');

  // 3️⃣ 获取结果
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

  const toSave: SjCandidate[] = [];

  // 4️⃣ 遍历方案序号
  for (const schemeNo of schemeIndexes) {
    // 根据方案序号查找对应方案
    const scheme = results.find(r => r['方案序号'] === schemeNo);
    if (!scheme) continue;

    const schemeId = `${task.task_uuid}-${scheme['方案序号']}`;

    // 5️⃣ 检查是否已存在
    const exists = await this.candidateRepo.findOne({
      where: { scheme_id: schemeId },
    });

    if (!exists) {
      toSave.push(
        this.candidateRepo.create({
          task,
          user,
          scheme_id: schemeId,
          result: scheme, // 确保 SjCandidate.result 支持 JSON 类型
          module_type: moduleType,
        }),
      );
    }
  }

  // 6️⃣ 保存
  if (toSave.length) await this.candidateRepo.save(toSave);

  return ApiResponse.success(
    { count: toSave.length },
    '候选方案保存成功',
  );
}


  /** ----------- 分页查询候选方案（对齐 History/Shared） ----------- */
  async list(user: User, query: ListCandidateDto) {
    const { module_type, date, page = 1, pageSize = 10 } = query;

    const where: any = { user: { user_id: user.user_id } };

    if (module_type) where.module_type = module_type;

    // 日期筛选 YYYY-MM-DD
    if (date) {
      const start = new Date(`${date} 00:00:00`);
      const end = new Date(`${date} 23:59:59`);
      where.created_at = Between(start, end);
    }

    const [records, total] = await this.candidateRepo.findAndCount({
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
      '获取候选方案成功',
    );
  }

  /** ----------- 删除候选方案（对齐 Shared/History） ----------- */
  async delete(user: User, ids: number[]) {
    const idArray = (Array.isArray(ids) ? ids : [ids]).map(Number);

    const result = await this.candidateRepo.delete({
      id: In(idArray),
      user: { user_id: user.user_id },
    });

    return ApiResponse.success(
      { count: result.affected || 0 },
      '删除候选方案成功',
    );
  }
}
