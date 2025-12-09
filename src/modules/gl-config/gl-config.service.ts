import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import _ from 'lodash';

import { ConfigGroup } from '../../database/entities/config-group.entity';
import { BizModule } from '../../database/entities/biz-module.entity';
import { User } from '../user/entities/user.entity';
import { GlMaterialInfo } from '../gl-material-info/entities/gl-material-info.entity';
import { GlFuelInfo } from '../gl-fuel-info/entities/gl-fuel-info.entity';

@Injectable()
export class GlConfigService {
  private readonly logger = new Logger(GlConfigService.name);

  constructor(
    @InjectRepository(ConfigGroup)
    private readonly configRepo: Repository<ConfigGroup>,
    @InjectRepository(BizModule)
    private readonly moduleRepo: Repository<BizModule>,
    @InjectRepository(GlMaterialInfo)
    private readonly rawRepo: Repository<GlMaterialInfo>,
    @InjectRepository(GlFuelInfo)
    private readonly fuelRepo: Repository<GlFuelInfo>,
  ) { }

  // ===================== 公共方法 =====================
  // ============================================================
// 获取模块默认参数组（不依赖用户）
// ============================================================
async getDefaultGroup(moduleName: string) {
  const module = await this.moduleRepo.findOne({ where: { name: moduleName } });
  if (!module) throw new Error(`模块 "${moduleName}" 不存在`);

  const defaultGroup = await this.configRepo.findOne({
    where: { module: { module_id: module.module_id }, is_default: true },
  });
  if (!defaultGroup) throw new Error(`模块 "${moduleName}" 没有默认参数组`);
  
  return defaultGroup;
}

// ============================================================
// 获取或创建用户专属参数组（不写 name）
// ============================================================
async getOrCreateUserGroup(user: User, moduleName: string) {
  const module = await this.moduleRepo.findOne({ where: { name: moduleName } });
  if (!module) throw new Error(`模块 "${moduleName}" 不存在`);

  // 查找用户最新参数组
  let group = await this.configRepo.findOne({
    where: {
      user: { user_id: user.user_id },
      module: { module_id: module.module_id },
      is_latest: true,
      is_default: false,
    },
  });

  // 用户没有 → 复制默认组
  if (!group) {
    const defaultGroup = await this.getDefaultGroup(moduleName);
    this.logger.log(`用户没有参数组，为用户复制默认参数组`);

    group = this.configRepo.create({
      user,
      module,
      config_data: _.cloneDeep(defaultGroup.config_data), // ❌ 不加 name
      is_latest: true,
      is_default: false,
    });
    await this.configRepo.save(group);
  }

  return group;
}

// ============================================================
// 获取用户最新参数组（读取时动态附加 name）
// ============================================================
// ============================================================
async getLatestConfigByName(user: User, moduleName: string) {
  const group = await this.getOrCreateUserGroup(user, moduleName);
  const configData = _.cloneDeep(group.config_data);

  // ----------------- 原料 -----------------
  const ingredientLimits = configData.ingredientLimits || {};
  const rawIds = Object.keys(ingredientLimits).map(id => Number(id));

  if (rawIds.length) {
    const raws = await this.rawRepo.findByIds(rawIds);
    const limitsWithName: Record<string, any> = {};
    raws.forEach(r => {
      if (ingredientLimits[r.id]) {
        limitsWithName[r.id] = {
          name: r.name,
          ...ingredientLimits[r.id],
        };
      }
    });
    configData.ingredientLimits = limitsWithName;
  }

  // ----------------- 燃料 -----------------
  const fuelLimits = configData.fuelLimits || {};
  const fuelIds = Object.keys(fuelLimits).map(id => Number(id));

  // 从 otherSettings 中取选择项
  const coalSelected = configData.otherSettings?.["煤比选择"];        // 比如 "3"
  const jiaodingSelected = configData.otherSettings?.["焦丁比选择"];  // 比如 "2"

  if (fuelIds.length) {
    const fuels = await this.fuelRepo.findByIds(fuelIds);
    const limitsWithName: Record<string, any> = {};

    fuels.forEach(f => {
      if (fuelLimits[f.id]) {
        // 默认空
        let type = "";

        if (String(f.id) === String(coalSelected)) {
          type = "煤比";
        } else if (String(f.id) === String(jiaodingSelected)) {
          type = "焦丁比";
        }

        limitsWithName[f.id] = {
          name: f.name,
          type,                // ← 新增字段（必需）
          ...fuelLimits[f.id], // ← low_limit, top_limit
        };
      }
    });

    configData.fuelLimits = limitsWithName;
  }

  return configData;
}




  // ===================== 高炉原料方法（块矿） =====================
  async getLatestIngredients(user: User, moduleName: string) {
    const group = await this.getOrCreateUserGroup(user, moduleName);
    const configData = _.cloneDeep(group.config_data || {});

    const ingredientLimits = configData.ingredientLimits || {};
    const ids = Object.keys(ingredientLimits).map(Number).filter(Boolean);
    if (ids.length) {
      const raws = await this.rawRepo.find({ where: { id: In(ids) } });
      const limitsWithName: Record<string, any> = {};
      raws.forEach(r => {
        if (ingredientLimits[r.id]) limitsWithName[r.id] = {...ingredientLimits[r.id] };
      });
      configData.ingredientLimits = limitsWithName;
    }

    return configData;
  }

  /** 保存选中原料（支持分类 & 全选模式） */
async saveSelectedIngredients(
  user: User,
  moduleName: string,
  selectedIds: number[],
  category?: string,
  name?: string,
) {
  const group = await this.getOrCreateUserGroup(user, moduleName);
  const configData = _.cloneDeep(group.config_data || {});

  if (!configData.otherSettings) configData.otherSettings = {};
  if (!Array.isArray(configData.otherSettings['块矿'])) configData.otherSettings['块矿'] = [];
  if (!Array.isArray(configData.otherSettings['固定配比'])) configData.otherSettings['固定配比'] = [];

  const cleanCat = category?.trim();
  const cleanName = name?.trim();

  const oldParams: number[] = configData.ingredientParams || [];
  const oldLimits: Record<string, any> = configData.ingredientLimits || {};

  // 空状态直接清空
  const isEmptyReset = (!selectedIds?.length) && !cleanCat && !cleanName;
  if (isEmptyReset) {
    group.config_data = {
      ...configData,
      ingredientParams: [],
      ingredientLimits: {},
      otherSettings: { '块矿': [], '固定配比': [] },
    };
    return await this.configRepo.save(group);
  }

  const newLimits: Record<string, any> = {};
  let newParams: number[] = [];

  const isCategoryMode = !!(cleanCat || cleanName);

  if (isCategoryMode) {
    let qb = this.rawRepo.createQueryBuilder('raw').where('raw.id IN (:...ids)', { ids: oldParams });
    if (cleanCat) qb = qb.andWhere('raw.category LIKE :cat', { cat: `${cleanCat}%` });
    if (cleanName) qb = qb.andWhere('raw.name LIKE :nm', { nm: `%${cleanName}%` });

    const oldCategoryIds = (await qb.getMany()).map(r => r.id);

    const toRemove = oldCategoryIds.filter(id => !selectedIds.includes(id));
    const toAdd = selectedIds.filter(id => !oldCategoryIds.includes(id));

    // 保留未变更且已有 limits 的项
    oldParams.forEach(id => {
      if (!toRemove.includes(id) && !toAdd.includes(id)) {
        if (oldLimits[id]) newLimits[id] = oldLimits[id];
      }
    });

    if (toAdd.length) {
      const addRaws = await this.rawRepo.find({ where: { id: In(toAdd) } });
      addRaws.forEach(r => newLimits[r.id] = { low_limit: 0, top_limit: 100 });
      addRaws.forEach(r => {
        if (r.category?.startsWith('K') && !configData.otherSettings['块矿'].includes(r.id)) {
          configData.otherSettings['块矿'].push(r.id);
        }
      });
    }

    newParams = [...oldParams.filter(id => !toRemove.includes(id)), ...toAdd];

    configData.otherSettings['块矿'] =
      configData.otherSettings['块矿'].filter((id: number) => !toRemove.includes(id));
    configData.otherSettings['固定配比'] =
      configData.otherSettings['固定配比'].filter((id: number) => !toRemove.includes(id));

  } else {
    // 全选模式
    const safeSelected = (selectedIds || []).filter(Boolean);
    const raws = safeSelected.length ? await this.rawRepo.find({ where: { id: In(safeSelected) } }) : [];

    raws.forEach(r => {
      if (oldLimits[r.id]) newLimits[r.id] = oldLimits[r.id];
      else newLimits[r.id] = { low_limit: 0, top_limit: 100 };
    });

    newParams = raws.map(r => r.id);

    configData.otherSettings['块矿'] = Array.from(
      new Set(raws.filter(r => r.category?.startsWith('K')).map(r => String(r.id)))
    );

    configData.otherSettings['固定配比'] = Array.from(
      new Set((configData.otherSettings['固定配比'] || [])
        .filter((id: number) => newParams.includes(Number(id)))
        .map(id => String(id)))
    );
  }

  group.config_data = {
    ...configData,
    ingredientParams: newParams,
    ingredientLimits: newLimits,
  };

  return await this.configRepo.save(group);
}


  async deleteSelectedIngredients(user: User, moduleName: string, removeIds: number[]) {
    const group = await this.getOrCreateUserGroup(user, moduleName);
    const configData = _.cloneDeep(group.config_data || {});
    const oldParams: number[] = configData.ingredientParams || [];
    const oldLimits: Record<string, any> = configData.ingredientLimits || {};

    const newParams = oldParams.filter(id => !removeIds.includes(id));
    const newLimits: Record<string, any> = {};
    Object.keys(oldLimits).forEach(id => {
      if (!removeIds.includes(Number(id))) newLimits[id] = oldLimits[id];
    });

    if (configData.otherSettings) {
      if (Array.isArray(configData.otherSettings['块矿'])) {
        configData.otherSettings['块矿'] = configData.otherSettings['块矿'].filter((id: number) => !removeIds.includes(Number(id)));
      }
      if (Array.isArray(configData.otherSettings['固定配比'])) {
        configData.otherSettings['固定配比'] = configData.otherSettings['固定配比'].filter((id: number) => !removeIds.includes(Number(id)));
      }
    }

    group.config_data = { ...configData, ingredientParams: newParams, ingredientLimits: newLimits };
    return await this.configRepo.save(group);
  }

  async getSelectedIngredients(options: {
    user: User;
    moduleName: string;
    page?: number;
    pageSize?: number;
    name?: string;
    type?: string;
  }) {
    const { user, moduleName, page = 1, pageSize = 10, name, type } = options;

    const group = await this.getOrCreateUserGroup(user, moduleName);
    const ingredientParams: number[] = group.config_data?.ingredientParams || [];

    if (!ingredientParams.length) {
      return { data: [], total: 0, page, pageSize, totalPages: 0 };
    }

    /** ---- 1. 构建 QueryBuilder，仅查询已选材料 ---- */
    let qb = this.rawRepo.createQueryBuilder('raw')
      .where('raw.id IN (:...ids)', { ids: ingredientParams })
      .orderBy('raw.id', 'ASC'); // 保持用户选择顺序

    /** ---- 2. 追加筛选条件 ---- */
    if (name) {
      qb = qb.andWhere('raw.name LIKE :name', { name: `%${name}%` });
    }

    if (type) {
      qb = qb.andWhere('raw.category LIKE :type', { type: `${type}%` });
    }

    /** ---- 3. 执行分页 ---- */
    const [records, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    /** ---- 4. 展开 composition 字段（保持你原来的格式） ---- */
    const formatRaw = (raw: any) => {
      const { id, category, name, composition, inventory, remark } = raw;
      if (!composition)
        return { id, category, name, inventory, remark };

      const {
        TFe = null,
        H2O = null,
        返矿率 = null,
        干基价格 = null,
        返矿价格 = null,
        ...others
      } = composition;

      return {
        id,
        category,
        name,
        TFe,
        ...others,
        H2O,
        返矿率,
        返矿价格,
        干基价格,
        inventory,
        remark
      };
    };

    return {
      data: records.map(formatRaw),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    };
  }



  async getSelectedFuels(options: {
    user: User;
    moduleName: string;
    page?: number;
    pageSize?: number;
    name?: string;
    type?: string;
  }) {
    const { user, moduleName, page = 1, pageSize = 10, name, type } = options;

    const group = await this.getOrCreateUserGroup(user, moduleName);
    const fuelParams: number[] = group.config_data?.fuelParams || [];

    if (!fuelParams.length) {
      return { data: [], total: 0, page, pageSize, totalPages: 0 };
    }

    /** ---- 1. 构建 QueryBuilder ---- */
    let qb = this.fuelRepo.createQueryBuilder('fuel')
      .where('fuel.id IN (:...ids)', { ids: fuelParams })
      .orderBy('fuel.id', 'ASC');

    /** ---- 2. 追加筛选 ---- */
    if (name) {
      qb = qb.andWhere('fuel.name LIKE :name', { name: `%${name}%` });
    }

    if (type) {
      qb = qb.andWhere('fuel.category LIKE :type', { type: `${type}%` });
    }

    /** ---- 3. 分页 ---- */
    const [records, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    /** ---- 4. 同样格式化 composition ---- */
    const formatFuel = (raw: any) => {
      const { id, category, name, composition, inventory, remark } = raw;

      if (!composition)
        return { id, category, name, inventory, remark };

      const {
        TFe = null,
        H2O = null,
        返矿率 = null,
        干基价格 = null,
        返矿价格 = null,
        ...others
      } = composition;

      return {
        id,
        category,
        name,
        TFe,
        ...others,
        H2O,
        返矿率,
        返矿价格,
        干基价格,
        inventory,
        remark,
      };
    };

    return {
      data: records.map(formatFuel),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    };
  }




  // ===================== 燃料方法 =====================
  /** 保存选中燃料（支持分类 & 全选模式） */
async saveSelectedFuels(
  user: User,
  moduleName: string,
  selectedIds: number[],
  category?: string,
  name?: string,
) {
  const group = await this.getOrCreateUserGroup(user, moduleName);
  const configData = _.cloneDeep(group.config_data || {});

  const cleanCat = category?.trim();
  const cleanName = name?.trim();

  const oldParams: number[] = configData.fuelParams || [];
  const oldLimits: Record<string, any> = configData.fuelLimits || {};

  const isEmptyReset = (!selectedIds?.length) && !cleanCat && !cleanName;
  if (isEmptyReset) {
    group.config_data = { ...configData, fuelParams: [], fuelLimits: {} };
    return await this.configRepo.save(group);
  }

  const newLimits: Record<string, any> = {};
  let newParams: number[] = [];

  const isCategoryMode = !!(cleanCat || cleanName);

  if (isCategoryMode) {
    let qb = this.fuelRepo.createQueryBuilder('fuel').where('fuel.id IN (:...ids)', { ids: oldParams });
    if (cleanCat) qb = qb.andWhere('fuel.category LIKE :cat', { cat: `${cleanCat}%` });
    if (cleanName) qb = qb.andWhere('fuel.name LIKE :nm', { nm: `%${cleanName}%` });

    const oldCategoryIds = (await qb.getMany()).map(r => r.id);

    const toRemove = oldCategoryIds.filter(id => !selectedIds.includes(id));
    const toAdd = selectedIds.filter(id => !oldCategoryIds.includes(id));

    oldParams.forEach(id => {
      if (!toRemove.includes(id) && oldLimits[id]) newLimits[id] = oldLimits[id];
    });

    if (toAdd.length) {
      const addFuels = await this.fuelRepo.find({ where: { id: In(toAdd) } });
      addFuels.forEach(f => {
        newLimits[f.id] = { low_limit: 0, top_limit: 100 };
      });
    }

    newParams = [...oldParams.filter(id => !toRemove.includes(id)), ...toAdd];

  } else {
    const safeSelected = (selectedIds || []).filter(Boolean);
    const fuels = safeSelected.length ? await this.fuelRepo.find({ where: { id: In(safeSelected) } }) : [];

    fuels.forEach(f => {
      if (oldLimits[f.id]) newLimits[f.id] = oldLimits[f.id];
      else newLimits[f.id] = { low_limit: 0, top_limit: 100 };
    });

    newParams = fuels.map(f => f.id);
  }

  group.config_data = {
    ...configData,
    fuelParams: newParams,
    fuelLimits: newLimits,
  };

  return await this.configRepo.save(group);
}




  async deleteSelectedFuels(user: User, moduleName: string, removeIds: number[]) {
    const group = await this.getOrCreateUserGroup(user, moduleName);
    const configData = _.cloneDeep(group.config_data || {});
    const oldParams: number[] = configData.fuelParams || [];
    const oldLimits: Record<string, any> = configData.fuelLimits || {};

    const newParams = oldParams.filter(id => !removeIds.includes(id));
    const newLimits: Record<string, any> = {};
    Object.keys(oldLimits).forEach(id => {
      if (!removeIds.includes(Number(id))) newLimits[id] = oldLimits[id];
    });

    group.config_data = { ...configData, fuelParams: newParams, fuelLimits: newLimits };
    return await this.configRepo.save(group);
  }
  // ===================== 保存完整配置 =====================
  async saveFullConfig(
    user: User,
    moduleName: string,
    ingredientLimits?: Record<string, any>,
    fuelLimits?: Record<string, any>,
    slagLimits?: Record<string, any>,
    hotMetalRatio?: Record<string, any>,
    loadTopLimits?: Record<string, any>,
    otherSettings?: Record<string, any>,
  ) {
    const group = await this.getOrCreateUserGroup(user, moduleName);
    group.config_data = _.merge({}, group.config_data || {}, {
      ...(ingredientLimits ? { ingredientLimits } : {}),
      ...(fuelLimits ? { fuelLimits } : {}),
      ...(slagLimits ? { slagLimits } : {}),
      ...(hotMetalRatio ? { hotMetalRatio } : {}),
      ...(loadTopLimits ? { loadTopLimits } : {}),
      ...(otherSettings ? { otherSettings } : {}),
    });
    return await this.configRepo.save(group);
  }
}
