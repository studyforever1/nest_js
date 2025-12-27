// sjconfig.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

import { ConfigGroup } from '../../database/entities/config-group.entity';
import { BizModule } from '../../database/entities/biz-module.entity';
import { User } from '../user/entities/user.entity';
import { SjRawMaterial } from '../sj-raw-material/entities/sj-raw-material.entity';
import { formatRaw } from '../sj-config/util/format-raw.util';
import _ from 'lodash';
import { In } from 'typeorm';
import { BadRequestException } from '@nestjs/common/exceptions';

@Injectable()
export class SjconfigService {
  private readonly logger = new Logger(SjconfigService.name);

  constructor(
    @InjectRepository(ConfigGroup)
    private readonly configRepo: Repository<ConfigGroup>,

    @InjectRepository(BizModule)
    private readonly moduleRepo: Repository<BizModule>,

    @InjectRepository(SjRawMaterial)
    private readonly rawRepo: Repository<SjRawMaterial>,
  ) {}

  // ============================================================
  // 公共工具函数
  // ============================================================

  /** 获取模块默认参数（必须 is_default = true） */
  async getDefaultGroup(moduleName: string) {
    const module = await this.moduleRepo.findOne({ where: { name: moduleName } });
    if (!module) throw new Error(`模块 "${moduleName}" 不存在`);

    return await this.configRepo.findOne({
      where: { module: { module_id: module.module_id }, is_default: true },
    });
  }

  /** 获取用户最新参数，如果没有，则复制默认参数生成 */
  async getOrCreateUserGroup(user: User, moduleName: string) {
    const module = await this.moduleRepo.findOne({ where: { name: moduleName } });
    if (!module) throw new Error(`模块 "${moduleName}" 不存在`);

    // 查询用户最新参数组（仅用户自己的组，不包含默认组）
    let group = await this.configRepo.findOne({
      where: {
        user: { user_id: user.user_id },
        module: { module_id: module.module_id },
        is_latest: true,
        is_default: false, // 排除默认组
      },
    });

    // 用户没有 → 复制默认参数生成自己的组
    if (!group) {
      const defaultGroup = await this.getDefaultGroup(moduleName);
      if (!defaultGroup) throw new Error(`模块 "${moduleName}" 没有默认参数组`);

      this.logger.log(`用户没有参数组，为用户复制默认参数组`);

      group = this.configRepo.create({
        user,
        module,
        config_data: _.cloneDeep(defaultGroup.config_data),
        is_latest: true,
        is_default: false, // 新用户组必须不是默认组
      });

      await this.configRepo.save(group);
    }

    return group;
  }

  // ============================================================
  // 业务接口方法
  // ============================================================

  /** 获取最新参数组（自动复制默认参数） */
  async getLatestConfigByName(user: User, moduleName: string) {
    const group = await this.getOrCreateUserGroup(user, moduleName);
    const configData = _.cloneDeep(group.config_data);

    // 追加原料名称到 ingredientLimits
    const ingredientLimits = configData.ingredientLimits || {};
    const rawIds = Object.keys(ingredientLimits).map((id) => Number(id));

    if (rawIds.length) {
      const raws = await this.rawRepo.findByIds(rawIds);
      const limitsWithName: Record<string, any> = {};

      raws.forEach((r) => {
        if (ingredientLimits[r.id]) {
          limitsWithName[r.id] = {
            name: r.name,
            ...ingredientLimits[r.id],
          };
        }
      });

      configData.ingredientLimits = limitsWithName;
    }

    return configData;
  }

  /** 保存完整参数组（深合并更新，不修改默认参数） */
  async saveFullConfig(
    user: User,
    moduleName: string,
    ingredientLimits?: Record<string, any>,
    chemicalLimits?: Record<string, any>,
    otherSettings?: Record<string, any>,
    SJProcessCost?: Record<string, any>
  ) {
    const group = await this.getOrCreateUserGroup(user, moduleName);

    group.config_data = _.merge({}, group.config_data || {}, {
      ...(ingredientLimits ? { ingredientLimits } : {}),
      ...(chemicalLimits ? { chemicalLimits } : {}),
      ...(otherSettings ? { otherSettings } : {}),
      ...(SJProcessCost ? { SJProcessCost } : {}),
    });

    return await this.configRepo.save(group);
  }

  /** 保存选择的原料序号（同步 ingredientLimits + 精粉列表） */

async saveSelectedIngredients(
  user: User,
  moduleName: string,
  selectedIds: number[],
  category?: string,
  name?: string,
) {
  const group = await this.getOrCreateUserGroup(user, moduleName);
  const configData = _.cloneDeep(group.config_data || {});
  const oldParams: number[] = configData.ingredientParams || [];
  const oldLimits: Record<string, any> = configData.ingredientLimits || {};

  if (!configData.otherSettings) configData.otherSettings = {};
  if (!Array.isArray(configData.otherSettings['精粉'])) configData.otherSettings['精粉'] = [];
  if (!Array.isArray(configData.otherSettings['固定配比'])) configData.otherSettings['固定配比'] = [];

  let newParams: number[] = [];
  const newLimits: Record<string, any> = { ...oldLimits };

  // ============================================================
  // ⭐ 判断分类同步模式
  // ============================================================
  const isCategoryMode =
    (category && category.trim() !== '') ||
    (name && name.trim() !== '');

  if (isCategoryMode) {
    // ============================================================
    // 分类同步模式
    // ============================================================
    let qb = this.rawRepo.createQueryBuilder('raw')
      .where('raw.id IN (:...ids)', { ids: oldParams });

    if (category?.trim()) qb = qb.andWhere('raw.category LIKE :cat', { cat: `${category}%` });
    if (name?.trim()) qb = qb.andWhere('raw.name LIKE :name', { name: `%${name}%` });

    const categoryIdsInDB = await qb.getMany().then(r => r.map(r => r.id));

    const toRemove = categoryIdsInDB.filter(id => !selectedIds.includes(id));
    const toAdd = selectedIds.filter(id => !categoryIdsInDB.includes(id));

    // 删除取消选中的 Limits
    toRemove.forEach(id => delete newLimits[id]);

    // 添加新增的 Limits
    toAdd.forEach(id => {
      if (!newLimits[id]) newLimits[id] = { low_limit: 0, top_limit: 100, lose_index: 1 };
    });

    newParams = Array.from(new Set([
      ...oldParams.filter(id => !toRemove.includes(id)),
      ...toAdd,
    ]));

    // 同步精粉 & 固定配比
    const raws = await this.rawRepo.findByIds(toAdd);
    raws.forEach(raw => {
      if (raw.category?.startsWith('T1') && !configData.otherSettings['精粉'].includes(raw.id)) {
        configData.otherSettings['精粉'].push(raw.id);
      }
    });

    // 移除取消的
    configData.otherSettings['精粉'] = Array.from(
      new Set(configData.otherSettings['精粉']
        .filter(id => !toRemove.includes(Number(id)))
        .map(id => String(id)))
    );

    configData.otherSettings['固定配比'] = Array.from(
      new Set(configData.otherSettings['固定配比']
        .filter(id => !toRemove.includes(Number(id)))
        .map(id => String(id)))
    );

  } else {
    // ============================================================
    // 全选模式
    // ============================================================

    // 删除取消选择的 Limits
    Object.keys(newLimits).forEach(idStr => {
      const id = Number(idStr);
      if (!selectedIds.includes(id)) delete newLimits[id];
    });

    // 新增原料添加默认 Limits（已有的保留原值）
    selectedIds.forEach(id => {
      if (!newLimits[id]) newLimits[id] = { low_limit: 0, top_limit: 100, lose_index: 1 };
    });

    newParams = Array.from(new Set(selectedIds));

    // 同步精粉 & 固定配比
    const raws = await this.rawRepo.findByIds(selectedIds);
    raws.forEach(raw => {
      if (raw.category?.startsWith('T1') && !configData.otherSettings['精粉'].includes(raw.id)) {
        configData.otherSettings['精粉'].push(raw.id);
      }
    });

    // 移除取消的 & 转成字符串 & 去重
    configData.otherSettings['精粉'] = Array.from(
      new Set(configData.otherSettings['精粉']
        .filter(id => selectedIds.includes(Number(id)))
        .map(id => String(id)))
    );

    configData.otherSettings['固定配比'] = Array.from(
      new Set(configData.otherSettings['固定配比']
        .filter(id => selectedIds.includes(Number(id)))
        .map(id => String(id)))
    );
  }

  // 保存最终数据
  group.config_data = {
    ...configData,
    ingredientParams: newParams,
    ingredientLimits: newLimits,
  };

  return await this.configRepo.save(group);
}





  /** 删除选中的原料（同步更新精粉 + 固定配比） */
  async deleteIngredientParams(user: User, moduleName: string, removeParams: number[]) {
  let group = await this.getOrCreateUserGroup(user, moduleName);

  const configData = _.cloneDeep(group.config_data || {});
  const oldParams: number[] = configData.ingredientParams || [];
  const oldLimits: Record<string, any> = configData.ingredientLimits || {};

  // 过滤掉删除的原料
  const newParams = oldParams.filter((id) => !removeParams.includes(id));

  const newLimits: Record<string, any> = {};
  Object.keys(oldLimits).forEach((id) => {
    if (!removeParams.includes(Number(id))) {
      newLimits[id] = oldLimits[id];
    }
  });

  // ==========================================================
  // 删除精粉和固定配比中对应的 T1 原料
  // ==========================================================
  if (configData.otherSettings) {
    // 精粉
    if (Array.isArray(configData.otherSettings['精粉'])) {
      configData.otherSettings['精粉'] = configData.otherSettings['精粉'].filter(
        (id: number | string) => !removeParams.includes(Number(id))
      );
    }

    // 固定配比
    if (Array.isArray(configData.otherSettings['固定配比'])) {
      configData.otherSettings['固定配比'] = configData.otherSettings['固定配比'].filter(
        (id: number | string) => !removeParams.includes(Number(id))
      );
    }
  }

  group.config_data = {
    ...configData,
    ingredientParams: newParams,
    ingredientLimits: newLimits,
  };

  return await this.configRepo.save(group);
}


  /** 获取已选原料（分页） */
  /** 获取已选原料（支持分页、名称模糊、分类筛选） */
async getSelectedIngredients(
  user: User,
  moduleName: string,
  page = 1,
  pageSize = 10,
  name?: string,
  type?: string,
) {
  const group = await this.getOrCreateUserGroup(user, moduleName);
  const configData = group.config_data || {};
  const ingredientParams: number[] = configData.ingredientParams || [];

  if (!ingredientParams.length) {
    return {
      data: [],
      total: 0,
      page,
      pageSize,
      totalPages: 0,
    };
  }

  /** ---- 1. 构建 query builder（先筛选用户所选原料） ---- */
  const qb = this.rawRepo.createQueryBuilder('raw')
    .where('raw.id IN (:...ids)', { ids: ingredientParams })
    .orderBy('raw.id', 'ASC'); // 保持顺序一致

  /** ---- 2. 追加搜索条件 ---- */
  if (name) {
    qb.andWhere('raw.name LIKE :name', { name: `%${name}%` });
  }

  if (type) {
    qb.andWhere('raw.category LIKE :cat', { cat: `${type}%` });
  }

  /** ---- 3. 获取总数（用于分页） ---- */
  const total = await qb.getCount();

  /** ---- 4. 分页查询 ---- */
  const records = await qb
    .skip((page - 1) * pageSize)
    .take(pageSize)
    .getMany();

  /** ---- 5. 统一格式化 ---- */
  const list = records.map(formatRaw);

  return {
    data: list,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}


// sjconfig.service.ts

async addSJProcessCost(
  user: User,
  items: Record<string, any>,
) {
  const group = await this.getOrCreateUserGroup(user, '烧结配料计算');

  const origin: Record<string, any> = group.config_data?.SJProcessCost || {};
  const newItems: Record<string, any> = {};

  // 1️⃣ 防重复 key
  for (const key of Object.keys(items)) {
    if (origin[key]) {
      throw new BadRequestException(`项目【${key}】已存在，不能重复添加`);
    }
    // 2️⃣ 自动计算单位成本
    newItems[key] = this.calcUnitCost(items[key]);
  }

  const merged = { ...origin, ...newItems };

  // 保存并同步 totalCost
  return await this.saveTableResultAndTotalCost(group, merged, '新增成功');
}

async deleteSJProcessCost(
  user: User,
  keys: string[],
) {
  const group = await this.getOrCreateUserGroup(user, '烧结配料计算');
  const costMap = { ...(group.config_data?.SJProcessCost || {}) };

  keys.forEach(key => delete costMap[key]);

  // 保存并同步 totalCost
  return await this.saveTableResultAndTotalCost(group, costMap, '删除成功', keys);
}

async updateSJProcessCost(
  user: User,
  key: string,
  payload: Record<string, any>,
) {
  const group = await this.getOrCreateUserGroup(user, '烧结配料计算');
  const origin: Record<string, any> = group.config_data?.SJProcessCost || {};

  if (!origin[key]) {
    throw new BadRequestException(`项目【${key}】不存在`);
  }

  const updatedItem = this.calcUnitCost({ ...origin[key], ...payload });
  origin[key] = updatedItem;

  // 保存并同步 totalCost
  return await this.saveTableResultAndTotalCost(group, origin, '更新成功');
}

// 前端表格 + 总金额统一返回，同时同步更新 otherSettings['其他费用']
private async saveTableResultAndTotalCost(
  group: ConfigGroup,
  sjProcessCost: Record<string, any>,
  message = '操作成功',
  deletedKeys: string[] = [],
) {
  const totalCost = this.calcTotalCost(sjProcessCost);

  if (!group.config_data.otherSettings) group.config_data.otherSettings = {};
  group.config_data.otherSettings['其他费用'] = totalCost;

  group.config_data = _.merge({}, group.config_data, {
    SJProcessCost: sjProcessCost,
    otherSettings: group.config_data.otherSettings,
  });

  await this.configRepo.save(group);

  return {
    success: true,
    message: `工序成本${message}`,
    ...(deletedKeys.length ? { deleted: deletedKeys } : {}),
    data: {
      list: this.toTableArray(sjProcessCost),
      totalCost,
    },
  };
}

// 分页获取工序成本列表
async getSJProcessCostList(
  user: User,
  page = 1,
  pageSize = 10,
  keyword?: string,
) {
  const group = await this.getOrCreateUserGroup(user, '烧结配料计算');
  const costMap: Record<string, any> = group.config_data?.SJProcessCost || {};

  let list = Object.entries(costMap).map(([name, val]) => ({ name, ...val }));

  if (keyword?.trim()) {
    const kw = keyword.trim();
    list = list.filter(item => item.name.includes(kw));
  }

  const total = list.length;
  const pagedList = list.slice((page - 1) * pageSize, page * pageSize);

  return {
    data: pagedList,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

// 工具函数
private toNumber(val: any): number {
  const num = Number(val);
  return isNaN(num) ? 0 : num;
}

private calcUnitCost(item: any): any {
  if (item?.项目分类 === '动力费用') {
    const price = this.toNumber(item.价格);
    const usage = this.toNumber(item.单位用量);
    return { ...item, 单位成本: +(price * usage).toFixed(4) };
  }
  return item;
}

private toTableArray(map: Record<string, any>) {
  return Object.entries(map).map(([name, val]) => ({ name, ...val }));
}

private calcTotalCost(map: Record<string, any>): number {
  return +Object.values(map)
    .reduce((sum, item: any) => sum + this.toNumber(item?.单位成本), 0)
    .toFixed(4);
}

}
