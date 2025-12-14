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
import { GlMaterialInfo } from '../gl-material-info/entities/gl-material-info.entity';

@Injectable()
export class SharedDataService {
  constructor(
    @InjectRepository(SharedData)
    private readonly sharedRepo: Repository<SharedData>,
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(GlMaterialInfo)
    private readonly rawRepo: Repository<GlMaterialInfo>,
  ) { }

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
    schemeIndexes: number[], // 这里是方案序号数组
    moduleType: string,
  ): Promise<ApiResponse<{ count: number }>> {
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

    // 4️⃣ 遍历方案序号
    for (const schemeNo of schemeIndexes) {
      // 根据方案序号查找对应方案
      const scheme = results.find(r => r['方案序号'] === schemeNo);
      if (!scheme) continue;

      const schemeId = `${task.task_uuid}-${scheme['方案序号']}`;

      // 5️⃣ 检查是否已存在
      const exists = await this.sharedRepo.findOne({
        where: { task: { task_uuid: task.task_uuid }, scheme_id: schemeId },
      });

      if (!exists) {
        sharedItems.push(
          this.sharedRepo.create({
            task,
            user,
            scheme_id: schemeId,
            result: scheme, // 确保 SharedData.result 字段是 JSON 类型
            module_type: moduleType,
          }),
        );
      }
    }

    // 6️⃣ 保存
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

  async importSharedToGlMaterial(
  user: User,
  sharedIds: number[],
) {
  if (!sharedIds?.length) return ApiResponse.error('未选择共享方案');

  const sharedRecords = await this.sharedRepo.find({
    where: { id: In(sharedIds), user: { user_id: user.user_id } },
  });

  if (!sharedRecords.length) return ApiResponse.error('没有找到有效共享方案');

  const toInsert: Partial<GlMaterialInfo>[] = [];
  const now = new Date();

  // 模板字段保持一致
  const templateKeys: Record<string, number> = { P: 0, S: 0, Cr: 0, Ni: 0, Pb: 0, Zn: 0, CaO: 0, H2O: 0, K2O: 0, MgO: 0, MnO: 0, TFe: 0, Na2O: 0, SiO2: 0, TiO2: 0, V2O5: 0, Al2O3: 0, R2: 0, '返矿率': 0, '干基价格': 0, '返矿价格': 500 };

  for (const record of sharedRecords) {
    if (record.module_type !== '烧结配料计算') continue;

    const result = typeof record.result === 'string' ? JSON.parse(record.result) : record.result;
    if (!result) continue;

    const composition: Record<string, number> = { ...templateKeys };

    const chem = result['化学成分'] || {};
    for (const key of Object.keys(templateKeys)) {
      if (key in chem) composition[key] = Number(chem[key]) || composition[key];
    }

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
      remark: record.scheme_id || '',
      created_at: now,
      updated_at: now,
    });
  }

  if (!toInsert.length) return ApiResponse.error('没有可导入的共享方案原料');

  await this.rawRepo.save(toInsert);

  return ApiResponse.success({ count: toInsert.length }, '导入高炉原料库成功');
}

}
