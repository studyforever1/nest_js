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
import { GlMaterialInfo } from '../gl-material-info/entities/gl-material-info.entity';


@Injectable()
export class HistoryService {
  constructor(
    @InjectRepository(History)
    private readonly historyRepo: Repository<History>,
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
     @InjectRepository(GlMaterialInfo)
    private readonly rawRepo: Repository<GlMaterialInfo>,
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
  schemeIndexes: number[], // 这里是方案序号数组
  moduleType: string,
): Promise<ApiResponse<{ count: number }>> {
  if (!results || !results.length) {
    return ApiResponse.error('没有可保存的方案数据');
  }

  const histories: History[] = [];

  for (const schemeNo of schemeIndexes) {
    // 根据方案序号查找对应方案
    const scheme = results.find(r => r['方案序号'] === schemeNo);
    if (!scheme) continue;

    const schemeId = `${task.task_uuid}-${scheme['方案序号']}`;

    const exists = await this.historyRepo.findOne({
      where: { task: { task_uuid: task.task_uuid }, scheme_id: schemeId },
    });

    if (!exists) {
      const history = this.historyRepo.create({
        task,
        user,
        scheme_id: schemeId,
        result: scheme,
        module_type: moduleType,
      });
      histories.push(history);
    }
  }

  if (!histories.length) {
    return ApiResponse.error('所有方案已存在或无有效方案可保存');
  }

  await this.historyRepo.save(histories);

  return ApiResponse.success(
    { count: histories.length },
    '方案保存成功',
  );
}

async importGLMaterialFromHistory(
  user: User,
  historyIds: number[],
) {
  if (!historyIds?.length) return ApiResponse.error('未选择历史方案');

  const histories = await this.historyRepo.find({
    where: { id: In(historyIds), user: { user_id: user.user_id } },
  });

  if (!histories.length) return ApiResponse.error('没有找到有效历史方案');

  const toInsert: Partial<GlMaterialInfo>[] = [];
  const now = new Date();

  // 标准模板字段，保证导入时字段一致
  const templateKeys: Record<string, number> = { P: 0, S: 0, Cr: 0, Ni: 0, Pb: 0, Zn: 0, CaO: 0, H2O: 0, K2O: 0, MgO: 0, MnO: 0, TFe: 0, Na2O: 0, SiO2: 0, TiO2: 0, V2O5: 0, Al2O3: 0, '返矿率': 0, '干基价格': 0, '返矿价格': 500 };


  for (const history of histories) {
    if (history.module_type !== '烧结配料计算') {
      continue;
    }

    const result = typeof history.result === 'string' ? JSON.parse(history.result) : history.result;
    if (!result) continue;

    const composition: Record<string, number> = { ...templateKeys };

    // 填充历史记录已有的化学成分
    const chem = result['化学成分'] || {};
    for (const key of Object.keys(templateKeys)) {
      if (key in chem) composition[key] = Number(chem[key]) || composition[key];
    }

    // 主要参数 -> 干基价格
    const mainParam = result['主要参数'] || {};
    if ('成本' in mainParam) composition['干基价格'] = Number(mainParam['成本']) || composition['干基价格'];

    toInsert.push({
      name: '自产烧结矿',
      composition,
      category: 'S',
      origin: '其他粉矿',
      inventory: 1000,
      modifier: user.username || 'admin',
      enabled: true,
      remark: history.scheme_id || '',
      created_at: now,
      updated_at: now,
    });
  }

  if (!toInsert.length) return ApiResponse.error('没有可导入的烧结优化配料方案原料');

  await this.rawRepo.save(toInsert);

  return ApiResponse.success(
    { count: toInsert.length },
    '导入高炉原料库成功'
  );
}
}


