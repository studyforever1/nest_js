// sjconfig.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

import { ConfigGroup } from '../../database/entities/config-group.entity';
import { BizModule } from '../../database/entities/biz-module.entity';
import { User } from '../user/entities/user.entity';
import { SjRawMaterial } from '../sj-raw-material/entities/sj-raw-material.entity';

import _ from 'lodash';

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
  ) {
    const group = await this.getOrCreateUserGroup(user, moduleName);

    group.config_data = _.merge({}, group.config_data || {}, {
      ...(ingredientLimits ? { ingredientLimits } : {}),
      ...(chemicalLimits ? { chemicalLimits } : {}),
      ...(otherSettings ? { otherSettings } : {}),
    });

    return await this.configRepo.save(group);
  }

  /** 保存选择的原料序号（同步 ingredientLimits + 精粉列表） */
  /** 保存选择的原料序号（重置 精粉 & 固定配比 列表） */
async saveIngredientParams(
  user: User,
  moduleName: string,
  ingredientParams: number[],
) {
  const group = await this.getOrCreateUserGroup(user, moduleName);
  const configData = _.cloneDeep(group.config_data || {});
  const oldLimits = configData.ingredientLimits || {};

  // ===============================
  // 1. 重建 ingredientLimits
  // ===============================
  const newLimits: Record<string, any> = {};
  ingredientParams.forEach((id) => {
    if (oldLimits[id]) {
      newLimits[id] = oldLimits[id];
    } else {
      newLimits[id] = {
        low_limit: 0,
        top_limit: 100,
        lose_index: 1,
      };
    }
  });

  // ===============================
  // 2. 选中原料查询
  // ===============================
  const raws = await this.rawRepo.findByIds(ingredientParams);

  // ===============================
  // 3. 重置：精粉 + 固定配比
  // ===============================
  configData.otherSettings = configData.otherSettings || {};

  // 完全重置
  configData.otherSettings['精粉'] = [];
  configData.otherSettings['固定配比'] = [];

  // ===============================
  // 4. 重新根据规则生成两个列表
  // ===============================

  raws.forEach((raw) => {
    // =========== 精粉规则：T1 开头 ===========
    if (raw.category?.startsWith('T1')) {
      configData.otherSettings['精粉'].push(raw.id);
    }

    // =========== 固定配比规则（如需自定义，在这里写） ===========
    // 假设固定配比规则是 category = 'FIX'
    if (raw.category === 'FIX') {
      configData.otherSettings['固定配比'].push(raw.id);
    }
  });

  // ===============================
  // 5. 保存
  // ===============================
  group.config_data = {
    ...configData,
    ingredientParams,
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
  async getSelectedIngredients(
    user: User,
    moduleName: string,
    page = 1,
    pageSize = 10,
  ) {
    const group = await this.getOrCreateUserGroup(user, moduleName);
    const configData = group.config_data || {};
    const ingredientParams: number[] = configData.ingredientParams || [];

    const total = ingredientParams.length;
    if (!total) return { total: 0, page, pageSize, list: [] };

    const start = (page - 1) * pageSize;
    const ids = ingredientParams.slice(start, start + pageSize);

    const raws = await this.rawRepo.findByIds(ids);

    const list = raws.map((raw) => {
      const { id, name, category, origin, composition } = raw;
      const { TFe, 价格, H2O, 烧损, ...otherCompo } = composition || {};
      return {
        id,
        name,
        category,
        origin,
        TFe: TFe ?? null,
        ...otherCompo,
        H2O: H2O ?? null,
        烧损: 烧损 ?? null,
        价格: 价格 ?? null,
      };
    });

    return { total, page, pageSize, list };
  }
}
