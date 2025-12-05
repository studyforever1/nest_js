import { Injectable, Logger } from '@nestjs/common';
import { Repository, In } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigGroup } from '../../database/entities/config-group.entity';
import { BizModule } from '../../database/entities/biz-module.entity';
import { User } from '../user/entities/user.entity';

@Injectable()
export class GlConfigService {
  private readonly logger = new Logger(GlConfigService.name);

  constructor(
    @InjectRepository(ConfigGroup)
    private readonly configRepo: Repository<ConfigGroup>,
    @InjectRepository(BizModule)
    private readonly moduleRepo: Repository<BizModule>,
  ) {}

  /** 获取用户最新参数，如果没有，则复制默认参数生成 */
  async getOrCreateUserGroup(user: User, moduleName: string) {
    const module = await this.moduleRepo.findOne({ where: { name: moduleName } });
    if (!module) throw new Error(`模块 "${moduleName}" 不存在`);

    let group = await this.configRepo.findOne({
      where: { user: { user_id: user.user_id }, module: { module_id: module.module_id }, is_latest: true, is_default: false },
    });

    if (!group) {
      const defaultGroup = await this.configRepo.findOne({ where: { module: { module_id: module.module_id }, is_default: true } });
      if (!defaultGroup) throw new Error(`模块 "${moduleName}" 没有默认参数组`);

      group = this.configRepo.create({
        user,
        module,
        config_data: JSON.parse(JSON.stringify(defaultGroup.config_data)),
        is_latest: true,
        is_default: false,
      });

      await this.configRepo.save(group);
    }

    return group;
  }

  /** 获取最新参数组 */
  async getLatestConfigByName(user: User, moduleName: string) {
    const group = await this.getOrCreateUserGroup(user, moduleName);
    return JSON.parse(JSON.stringify(group.config_data));
  }

  /** 保存完整参数组 */
  async saveFullConfig(
    user: User,
    moduleName: string,
    ingredientLimits?: Record<string, any>,
    fuelLimits?: Record<string, any>,
    slagLimits?: Record<string, any>,
    hotMetalRatio?: Record<string, any>,
    loadTopLimits?: Record<string, any>,
    ironWaterTopLimits?: Record<string, any>,
    otherSettings?: Record<string, any>,
  ) {
    const group = await this.getOrCreateUserGroup(user, moduleName);

    group.config_data = {
      ...group.config_data,
      ...(ingredientLimits ? { ingredientLimits } : {}),
      ...(fuelLimits ? { fuelLimits } : {}),
      ...(slagLimits ? { slagLimits } : {}),
      ...(hotMetalRatio ? { hotMetalRatio } : {}),
      ...(loadTopLimits ? { loadTopLimits } : {}),
      ...(ironWaterTopLimits ? { ironWaterTopLimits } : {}),
      ...(otherSettings ? { otherSettings } : {}),
    };

    return await this.configRepo.save(group);
  }

  /** 保存选中原料/燃料（支持两种模式：全选覆盖 或 分类增量同步） */
  async saveSelectedIngredients(
    user: User,
    moduleName: string,
    selectedIds: number[],
    category?: string,
    name?: string,
    type: 'ingredient' | 'fuel' = 'ingredient',
  ) {
    const group = await this.getOrCreateUserGroup(user, moduleName);
    const config = JSON.parse(JSON.stringify(group.config_data || {}));

    // 初始化两套结构，确保不会 undefined
    if (!config.ingredientLimits) config.ingredientLimits = {};
    if (!config.fuelLimits) config.fuelLimits = {};
    if (!config.ingredientParams) config.ingredientParams = [];
    if (!config.fuelParams) config.fuelParams = [];

    const keyLimits = type === 'fuel' ? 'fuelLimits' : 'ingredientLimits';
    const keyParams = type === 'fuel' ? 'fuelParams' : 'ingredientParams';

    // 分类模式判断（任一非空，则视为分类模式）
    const isCategoryMode = (category && category.trim() !== '') || (name && name.trim() !== '');

    if (isCategoryMode) {
      // 分类模式：对该分类下的历史选中进行差异对比 ----
      // NOTE: 这里的实现是通用版本（如果需要根据 DB 的 category/name 精确查询 raw 表并计算 toAdd/toRemove，
      // 可以把 rawRepo 注入并查询真实数据库；当前版本只在已有的 Params 列表上做对比）
      const oldParams: number[] = Array.isArray(config[keyParams]) ? config[keyParams].map((i: any) => Number(i)) : [];

      // 计算 toAdd / toRemove（基于前端传来的 selectedIds 与历史 selected 列表做差异）
      const toAdd = selectedIds.filter(id => !oldParams.includes(id));
      const toRemove = oldParams.filter(id => !selectedIds.includes(id));

      // 删除取消的
      toRemove.forEach(id => {
        delete config[keyLimits][id];
      });

      // 添加新增的并初始化 limits（如果不存在）
      toAdd.forEach(id => {
        if (!config[keyLimits][id]) {
          config[keyLimits][id] = { low_limit: 0, top_limit: 100 };
        }
      });

      // 更新 Params 列表（保留原有在其他分类保留的项）
      const merged = Array.from(new Set([
        ...oldParams.filter(id => !toRemove.includes(id)),
        ...toAdd,
      ]));

      config[keyParams] = merged;

    } else {
      // 全选覆盖模式：selectedIds 作为新的完整列表
      // 1. 为每个 selectedId 确保在 limits 中存在
      selectedIds.forEach(id => {
        if (!config[keyLimits][id]) config[keyLimits][id] = { low_limit: 0, top_limit: 100 };
      });

      // 2. 删除 limits 中不在 selectedIds 的项（保持一致）
      Object.keys(config[keyLimits]).forEach(k => {
        const idNum = Number(k);
        if (!selectedIds.includes(idNum)) {
          delete config[keyLimits][k];
        }
      });

      // 3. 设置 params 为 selectedIds（唯一化）
      config[keyParams] = Array.from(new Set(selectedIds));
    }

    group.config_data = config;
    return await this.configRepo.save(group);
  }

  /** 删除选中原料/燃料（同步更新 Limits 与 Params） */
  async deleteSelected(
    user: User,
    moduleName: string,
    removeIds: number[],
    type: 'ingredient' | 'fuel' = 'ingredient',
  ) {
    const group = await this.getOrCreateUserGroup(user, moduleName);
    const config = JSON.parse(JSON.stringify(group.config_data || {}));

    const keyLimits = type === 'fuel' ? 'fuelLimits' : 'ingredientLimits';
    const keyParams = type === 'fuel' ? 'fuelParams' : 'ingredientParams';

    if (!config[keyLimits]) config[keyLimits] = {};
    if (!config[keyParams]) config[keyParams] = [];

    // 从 limits 中删除
    removeIds.forEach(id => {
      delete config[keyLimits][id];
    });

    // 从 params 数组中移除
    config[keyParams] = (config[keyParams] || []).filter((id: number) => !removeIds.includes(Number(id)));

    group.config_data = config;
    return await this.configRepo.save(group);
  }

  /** 分页获取已选原料/燃料（返回 id + limits） */
  async getSelectedItems(
    user: User,
    moduleName: string,
    page = 1,
    pageSize = 10,
    name?: string,
    type: 'ingredient' | 'fuel' = 'ingredient',
  ) {
    const group = await this.getOrCreateUserGroup(user, moduleName);
    const config = group.config_data || {};
    const keyLimits = type === 'fuel' ? 'fuelLimits' : 'ingredientLimits';
    const keyParams = type === 'fuel' ? 'fuelParams' : 'ingredientParams';

    const selectedIds: number[] = Array.isArray(config[keyParams])
      ? config[keyParams].map((i: any) => Number(i))
      : Object.keys(config[keyLimits] || {}).map(k => Number(k));

    const total = selectedIds.length;
    const start = (page - 1) * pageSize;
    const end = page * pageSize;
    const pagedIds = selectedIds.slice(start, end);

    const items = pagedIds.map(id => ({
      id,
      ...(config[keyLimits] && config[keyLimits][id] ? config[keyLimits][id] : {}),
    }));

    return {
      data: items,
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}
