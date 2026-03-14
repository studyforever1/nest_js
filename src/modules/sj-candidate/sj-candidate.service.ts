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

  /** ================= 化学成分顺序常量 ================= */
  private readonly chemicalOrder = [
    'TFe',
    'SiO2',
    'CaO',
    'MgO',
    'Al2O3',
    'P',
    'S',
    'TiO2',
    'K2O',
    'Na2O',
    'Zn',
    'As',
    'Pb',
    'V2O5',
    'R2',
    '镁铝比',
  ];

  /** ================= 通用基础结构 ================= */
  private buildBaseInfo(item: SjCandidate) {
    return {
      id: item.id,
      scheme_id: item.scheme_id,
      module_type: item.module_type,
      created_at: dayjs(item.created_at).format('YYYY-MM-DD HH:mm:ss'),
      task_uuid: item.task?.task_uuid || null,
      username: item.user?.username || null,
    };
  }

  /** ================= 化学成分排序 ================= */
/** ================= 化学成分排序（仅排序，不改结构） ================= */
private reorderChemical(chemicalSource: any) {
  const result: Record<string, any> = {};

  // 1️⃣ 按固定顺序排
  this.chemicalOrder.forEach(key => {
    if (chemicalSource?.hasOwnProperty(key)) {
      result[key] = chemicalSource[key]; // ✅ 直接保留原结构
    }
  });

  // 2️⃣ 追加未定义字段
  Object.keys(chemicalSource || {}).forEach(key => {
    if (!result.hasOwnProperty(key)) {
      result[key] = chemicalSource[key];
    }
  });

  return result;
}

  /** ================= 烧结配料格式器 ================= */
private formatSinterScheme(item: SjCandidate) {
  const scheme = item.result;
  if (!scheme) return null;

  // 烧结配料主要参数顺序 (sj.txt) - 动态构建
  const buildDynamicSjMainOrder = (mainParams: Record<string, any>) => {
    const order: string[] = [];
    
    // 按照 sj.txt 的顺序
    if ('成本(元)' in mainParams) order.push('成本(元)');
    if ('吨度价' in mainParams) order.push('吨度价');
    if ('干基总消耗(t/t)' in mainParams) order.push('干基总消耗(t/t)');
    if ('干基总残存(%)' in mainParams) order.push('干基总残存(%)');
    if ('预测烧结烟气含流量(mg/Nm3)' in mainParams) order.push('预测烧结烟气含流量(mg/Nm3)');
    
    return order;
  };

  const sortMainParams = (source: Record<string, any>) => {
    const order = buildDynamicSjMainOrder(source);
    const sorted: Record<string, any> = {};
    order.forEach(key => {
      if (source?.[key] != null) sorted[key] = source[key];
    });
    Object.keys(source || {}).forEach(key => {
      if (!sorted[key]) sorted[key] = source[key];
    });
    return sorted;
  };

  // 保留原结构（可能是 {value, low_limit, top_limit} 或直接数字）
  const reorderedChem = this.reorderChemical(scheme['化学成分']);

  return {
    方案序号: scheme['方案序号'],
    成本排名: scheme['成本排名'],
    吨度价排名: scheme['吨度价排名'],
    主要参数: sortMainParams(scheme['主要参数'] || {}),
    化学成分: reorderedChem,
    原料配比: scheme['原料配比'] || {},
  };
}

  /** ================= 统一格式入口 ================= */
  private formatByModule(item: SjCandidate) {
    const base = this.buildBaseInfo(item);

    switch (item.module_type) {
      case '烧结配料计算':
        return {
          ...base,
          result: this.formatSinterScheme(item),
        };

      default:
        return {
          ...base,
          result: item.result,
        };
    }
  }

  /** ================= 批量保存候选方案 ================= */
  async saveCandidate(
    taskUuid: string,
    userId: number,
    schemeIndexes: number[],
    moduleType: string,
  ) {
    const task = await this.taskRepo.findOne({
      where: { task_uuid: taskUuid },
      relations: ['results'],
    });
    if (!task) return ApiResponse.error('任务不存在');

    const user = await this.userRepo.findOneBy({ user_id: userId });
    if (!user) return ApiResponse.error('用户不存在');

    const resultEntity = task.results?.[0];
    if (!resultEntity?.output_data)
      return ApiResponse.error('任务结果为空');

    let results = resultEntity.output_data;
    if (typeof results === 'string') {
      try {
        results = JSON.parse(results);
      } catch {
        return ApiResponse.error('任务结果 JSON 解析失败');
      }
    }

    const toSave: SjCandidate[] = [];

    for (const schemeNo of schemeIndexes) {
      const scheme = results.find(r => r['方案序号'] === schemeNo);
      if (!scheme) continue;

      const schemeId = `${task.task_uuid}-${schemeNo}`;

      const exists = await this.candidateRepo.findOne({
        where: { scheme_id: schemeId },
      });

      if (!exists) {
        toSave.push(
          this.candidateRepo.create({
            task,
            user,
            scheme_id: schemeId,
            result: scheme,
            module_type: moduleType,
          }),
        );
      }
    }

    if (toSave.length) await this.candidateRepo.save(toSave);

    return ApiResponse.success(
      { count: toSave.length },
      '候选方案保存成功',
    );
  }

  /** ================= 分页查询 ================= */
  async list(user: User, query: ListCandidateDto) {
    const { module_type, date, page = 1, pageSize = 10 } = query;

    const where: any = { user: { user_id: user.user_id } };

    if (module_type) where.module_type = module_type;

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
        data: records.map(item => this.formatByModule(item)),
        total,
        page: Number(page),
        pageSize: Number(pageSize),
        totalPages: Math.ceil(total / pageSize),
      },
      '获取候选方案成功',
    );
  }

  /** ================= 删除 ================= */
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

  /** ================= 根据ID获取 ================= */
  async getById(user: User, id: number) {
    const item = await this.candidateRepo.findOne({
      where: {
        id,
        user: { user_id: user.user_id },
      },
      relations: ['task', 'user'],
    });

    if (!item) {
      return ApiResponse.error('候选方案不存在');
    }

    return ApiResponse.success(
      this.formatByModule(item),
      '获取候选方案成功',
    );
  }
}