import { Injectable, Logger, BadRequestException } from '@nestjs/common';
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
  // 1️⃣ 获取当前模块用户组
  const group = await this.getOrCreateUserGroup(user, moduleName);
  const moduleData = _.cloneDeep(group.config_data || {});

  // 2️⃣ 获取公共参数模块
  const commonModuleName = '铁前一体化配料计算I';
  const commonGroup = await this.getOrCreateUserGroup(user, commonModuleName);
  const commonData = _.cloneDeep(commonGroup.config_data || {});

  // 3️⃣ 公共参数
  const publicKeys = [
    'ingredientLimits',
    'fuelLimits',
    'slagLimits',
    'hotMetalRatio',
    'loadTopLimits',
    'ironWaterTopLimits',
  ];

  const configData: Record<string, any> = {};
  publicKeys.forEach(key => {
    configData[key] = commonData[key] || {};
  });

  // 4️⃣ 模块专属 otherSettings
  configData.otherSettings = moduleData.otherSettings || {};

  // =============================
  // ⭐ 生铁固定配料计算：额外返回结果并加上 name + value
  // =============================
  if (moduleName === '生铁固定配料计算') {
    const ingredientResultsRaw: Record<string, number> = moduleData.ingredientResults || {};
    const fuelResultsRaw: Record<string, number> = moduleData.fuelResults || {};

    // ingredientResults 映射 id -> { name, value }
    const ingredientIds = Object.keys(ingredientResultsRaw).map(id => Number(id));
    const raws = ingredientIds.length ? await this.rawRepo.findByIds(ingredientIds) : [];
    const ingredientResults: Record<string, any> = {};

    raws.forEach(r => {
      const idStr = String(r.id);
      ingredientResults[idStr] = {
        name: r.name,
        value: ingredientResultsRaw[idStr] ?? 0,
      };
    });

    configData.ingredientResults = ingredientResults;

    // fuelResults 映射 id -> { name, value }
    const fuelIds = Object.keys(fuelResultsRaw).map(id => Number(id));
    const fuels = fuelIds.length ? await this.fuelRepo.findByIds(fuelIds) : [];
    const fuelResults: Record<string, any> = {};

    fuels.forEach(f => {
      const idStr = String(f.id);
      fuelResults[idStr] = {
        name: f.name,
        value: fuelResultsRaw[idStr] ?? 0,
      };
    });

    configData.fuelResults = fuelResults;
  }

  // 5️⃣ ingredientLimits 附加 name
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

  // 6️⃣ fuelLimits 附加 name / type
  const fuelLimits = configData.fuelLimits || {};
  const fuelIds = Object.keys(fuelLimits).map(id => Number(id));

  const coalSelected = configData.otherSettings?.['煤比选择'];
  const jiaodingSelected = configData.otherSettings?.['焦丁比选择'];

  if (fuelIds.length) {
    const fuels = await this.fuelRepo.findByIds(fuelIds);
    const limitsWithName: Record<string, any> = {};

    fuels.forEach(f => {
      if (fuelLimits[f.id]) {
        let type = '';
        if (String(f.id) === String(coalSelected)) type = '煤比';
        else if (String(f.id) === String(jiaodingSelected)) type = '焦丁比';

        limitsWithName[f.id] = {
          name: f.name,
          type,
          ...fuelLimits[f.id],
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
        返焦率 = null,
        干基价格 = null,
        返焦价格 = null,
        ...others
      } = composition;

      return {
        id,
        category,
        name,
        TFe,
        ...others,
        H2O,
        返焦率,
        返焦价格,
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



// ===================== 同步方法 =====================
private async syncAcrossModules(
  user: User,
  ingredientParams: number[],
  ingredientLimits: Record<string, any>,
  fuelParams: number[],
  fuelLimits: Record<string, any>,
  otherSettings: Record<string, any>,
  excludeModule?: string
) {
  const modulesToSync = [
    '高炉配料计算',
    '铁前一体化配料计算I',
    '铁前一体化配料计算II',
    '利润一体化配料计算'
  ].filter(m => m !== excludeModule);

  for (const moduleName of modulesToSync) {
    const group = await this.getOrCreateUserGroup(user, moduleName);
    const existingData = _.cloneDeep(group.config_data || {});

    group.config_data = _.merge({}, existingData, {
      ingredientParams,
      ingredientLimits,
      fuelParams,
      fuelLimits,
      otherSettings,
    });

    await this.configRepo.save(group);
  }
}

// ===================== 原料 =====================
// ===================== 原料 =====================
// ===================== 原料 =====================
// ===================== 原料 =====================
// ===================== 保存选中原料 =====================
async saveSelectedIngredients(
  user: User,
  moduleName: string,
  selectedIds: number[],
  category?: string,
  name?: string,
) {
  // 1️⃣ 获取或创建当前模块配置
  const group = await this.getOrCreateUserGroup(user, moduleName);
  const configData = _.cloneDeep(group.config_data || {});

  // 2️⃣ 初始化 otherSettings
  if (!configData.otherSettings) configData.otherSettings = {};
  if (!Array.isArray(configData.otherSettings['块矿'])) configData.otherSettings['块矿'] = [];
  if (!Array.isArray(configData.otherSettings['固定配比'])) configData.otherSettings['固定配比'] = [];

  const cleanCat = category?.trim();
  const cleanName = name?.trim();

  const oldParams: number[] = configData.ingredientParams || [];
  const oldLimits: Record<string, any> = configData.ingredientLimits || {};

  const isEmptyReset = (!selectedIds?.length) && !cleanCat && !cleanName;

  let newParams: number[] = [];
  let newLimits: Record<string, any> = {};
  const newOtherSettings = _.cloneDeep(configData.otherSettings || {});

  // 3️⃣ 非清空逻辑
  if (!isEmptyReset) {
    // 3.1 按分类 / 名称局部更新
    if (cleanCat || cleanName) {
      let qb = this.rawRepo
        .createQueryBuilder('raw')
        .where('raw.id IN (:...ids)', { ids: oldParams });

      if (cleanCat) qb = qb.andWhere('raw.category LIKE :cat', { cat: `${cleanCat}%` });
      if (cleanName) qb = qb.andWhere('raw.name LIKE :nm', { nm: `%${cleanName}%` });

      const oldCategoryIds = (await qb.getMany()).map(r => r.id);
      const toRemove = oldCategoryIds.filter(id => !selectedIds.includes(id));
      const toAdd = selectedIds.filter(id => !oldCategoryIds.includes(id));

      // 保留未变原料的限制
      oldParams.forEach(id => {
        if (!toRemove.includes(id) && !toAdd.includes(id) && oldLimits[id]) {
          newLimits[id] = oldLimits[id];
        }
      });

      // 新增原料
      if (toAdd.length) {
        // ⭐ 获取内置矿粉配比数据（BuiltinPowder），用于在选择高炉原料时自动设置上下限
        const builtinPowderGroup = await this.getOrCreateUserGroup(user, '单独高炉配料计算');
        const builtinPowderMap: Record<string, any> = builtinPowderGroup.config_data?.BuiltinPowder || {};
        
        const addRaws = await this.rawRepo.find({ where: { id: In(toAdd) } });
        addRaws.forEach(r => {
          // 检查是否在内置矿粉配比中
          const builtinPowder = builtinPowderMap[r.name];
          if (builtinPowder) {
            // 如果在内置矿粉配比中，使用其上下限
            newLimits[r.id] = {
              low_limit: builtinPowder.low_limit ?? 0,
              top_limit: builtinPowder.top_limit ?? 100,
            };
          } else {
            // 否则使用默认值
            newLimits[r.id] = { low_limit: 0, top_limit: 100 };
          }
          if (r.category?.startsWith('K')) newOtherSettings['块矿'].push(r.id);
        });
      }

      newParams = [...oldParams.filter(id => !toRemove.includes(id)), ...toAdd];

    } else {
      // 3.2 全量替换
      // ⭐ 获取内置矿粉配比数据（BuiltinPowder），用于在选择高炉原料时自动设置上下限
      const builtinPowderGroup = await this.getOrCreateUserGroup(user, '单独高炉配料计算');
      const builtinPowderMap: Record<string, any> = builtinPowderGroup.config_data?.BuiltinPowder || {};
      
      const raws = selectedIds.length ? await this.rawRepo.find({ where: { id: In(selectedIds) } }) : [];
      raws.forEach(r => {
        // 如果已有限制，保留；否则检查是否在内置矿粉配比中
        if (oldLimits[r.id]) {
          newLimits[r.id] = oldLimits[r.id];
        } else {
          const builtinPowder = builtinPowderMap[r.name];
          if (builtinPowder) {
            // 如果在内置矿粉配比中，使用其上下限
            newLimits[r.id] = {
              low_limit: builtinPowder.low_limit ?? 0,
              top_limit: builtinPowder.top_limit ?? 100,
            };
          } else {
            // 否则使用默认值
            newLimits[r.id] = { low_limit: 0, top_limit: 100 };
          }
        }
      });
      newParams = raws.map(r => r.id);
      newOtherSettings['块矿'] = raws.filter(r => r.category?.startsWith('K')).map(r => r.id);
    }
  }

  // 4️⃣ 清理固定配比中已被移除的原料
  if (Array.isArray(newOtherSettings['固定配比'])) {
    newOtherSettings['固定配比'] = newOtherSettings['固定配比'].filter(id => newParams.includes(Number(id)));
  }

  // 5️⃣ 保存当前模块
  group.config_data = {
    ...configData,
    ingredientParams: newParams,
    ingredientLimits: newLimits,
    otherSettings: newOtherSettings,
  };
  await this.configRepo.save(group);

  // 6️⃣ 同步到其他模块（含 生铁固定配料计算特殊处理）
  const allModules = [
    '单独高炉配料计算',
    '铁前一体化配料计算I',
    '铁前一体化配料计算II',
    '利润一体化配料计算',
    '生铁固定配料计算',
  ];
  const otherModules = allModules.filter(m => m !== moduleName);

  for (const other of otherModules) {
    const otherGroup = await this.getOrCreateUserGroup(user, other);
    const otherData = _.cloneDeep(otherGroup.config_data || {});

    if (other === '生铁固定配料计算') {
      const oldResults: Record<string, number> = otherData.ingredientResults || {};
      const newResults: Record<string, number> = {};

      for (const id of newParams) {
        const key = String(id);
        newResults[key] = oldResults[key] !== undefined ? oldResults[key] : newLimits[id]?.low_limit ?? 0;
      }

      otherGroup.config_data = {
        ...otherData,
        ingredientParams: newParams,
        ingredientLimits: newLimits,
        ingredientResults: newResults,
        otherSettings: {
          ...(otherData.otherSettings || {}),
          '块矿': newOtherSettings['块矿'],
          '固定配比': newOtherSettings['固定配比'],
        },
      };

    } else {
      otherGroup.config_data = {
        ...otherData,
        ingredientParams: newParams,
        ingredientLimits: newLimits,
        otherSettings: {
          ...(otherData.otherSettings || {}),
          '块矿': newOtherSettings['块矿'],
          '固定配比': newOtherSettings['固定配比'],
        },
      };
    }

    await this.configRepo.save(otherGroup);
  }

  return { data: group.config_data };
}


// ===================== 删除选中原料 =====================
async deleteSelectedIngredients(
  user: User,
  moduleName: string,
  removeIds: number[],
) {
  const group = await this.getOrCreateUserGroup(user, moduleName);
  const configData = _.cloneDeep(group.config_data || {});

  const oldParams: number[] = configData.ingredientParams || [];
  const oldLimits: Record<string, any> = configData.ingredientLimits || {};

  const newParams = oldParams.filter(id => !removeIds.includes(id));

  const newLimits: Record<string, any> = {};
  Object.keys(oldLimits).forEach(id => {
    if (!removeIds.includes(Number(id))) newLimits[id] = oldLimits[id];
  });

  const newOtherSettings = _.cloneDeep(configData.otherSettings || {});

  if (Array.isArray(newOtherSettings['块矿'])) {
    newOtherSettings['块矿'] = newOtherSettings['块矿'].filter(id => !removeIds.includes(Number(id)));
  }

  if (Array.isArray(newOtherSettings['固定配比'])) {
    newOtherSettings['固定配比'] = newOtherSettings['固定配比'].filter(id => newParams.includes(Number(id)));
  }

  group.config_data = {
    ...configData,
    ingredientParams: newParams,
    ingredientLimits: newLimits,
    otherSettings: newOtherSettings,
  };
  await this.configRepo.save(group);

  // 同步到其他模块（含 生铁固定配料计算）
  const allModules = [
    '单独高炉配料计算',
    '铁前一体化配料计算I',
    '铁前一体化配料计算II',
    '利润一体化配料计算',
    '生铁固定配料计算',
  ];
  const otherModules = allModules.filter(m => m !== moduleName);

  for (const other of otherModules) {
    const otherGroup = await this.getOrCreateUserGroup(user, other);
    const otherData = _.cloneDeep(otherGroup.config_data || {});

    if (other === '生铁固定配料计算') {
      const oldResults: Record<string, number> = otherData.ingredientResults || {};
      const newResults: Record<string, number> = {};

      for (const id of newParams) {
        const key = String(id);
        if (oldResults[key] !== undefined) newResults[key] = oldResults[key];
      }

      otherGroup.config_data = {
        ...otherData,
        ingredientParams: newParams,
        ingredientLimits: newLimits,
        ingredientResults: newResults,
        otherSettings: {
          ...(otherData.otherSettings || {}),
          '块矿': newOtherSettings['块矿'],
          '固定配比': newOtherSettings['固定配比'],
        },
      };

    } else {
      otherGroup.config_data = {
        ...otherData,
        ingredientParams: newParams,
        ingredientLimits: newLimits,
        otherSettings: {
          ...(otherData.otherSettings || {}),
          '块矿': newOtherSettings['块矿'],
          '固定配比': newOtherSettings['固定配比'],
        },
      };
    }

    await this.configRepo.save(otherGroup);
  }

  return { data: group.config_data };
}







// ===================== 燃料 =====================
// ===================== 保存选中燃料 =====================
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

  let newParams: number[] = [];
  let newLimits: Record<string, any> = {};

  if (!isEmptyReset) {
    // 分类/名称局部更新
    if (cleanCat || cleanName) {
      let qb = this.fuelRepo
        .createQueryBuilder('fuel')
        .where('fuel.id IN (:...ids)', { ids: oldParams });

      if (cleanCat) qb = qb.andWhere('fuel.category LIKE :cat', { cat: `${cleanCat}%` });
      if (cleanName) qb = qb.andWhere('fuel.name LIKE :nm', { nm: `%${cleanName}%` });

      const oldCategoryIds = (await qb.getMany()).map(f => f.id);
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
      // 全量替换
      const fuels = selectedIds.length ? await this.fuelRepo.find({ where: { id: In(selectedIds) } }) : [];
      fuels.forEach(f => newLimits[f.id] = oldLimits[f.id] || { low_limit: 0, top_limit: 100 });
      newParams = fuels.map(f => f.id);
    }
  }

  // 🔧 保存当前模块
  group.config_data = {
    ...configData,
    fuelParams: newParams,
    fuelLimits: newLimits,
  };
  await this.configRepo.save(group);

  // 🔧 跨模块同步（含生铁固定配料计算特殊处理 fuelResults）
  const allModules = [
    '单独高炉配料计算',
    '铁前一体化配料计算I',
    '铁前一体化配料计算II',
    '利润一体化配料计算',
    '生铁固定配料计算',
  ];
  const otherModules = allModules.filter(m => m !== moduleName);

  for (const other of otherModules) {
    const otherGroup = await this.getOrCreateUserGroup(user, other);
    const otherData = _.cloneDeep(otherGroup.config_data || {});

    if (other === '生铁固定配料计算') {
      const oldResults: Record<string, number> = otherData.fuelResults || {};
      const newResults: Record<string, number> = {};

      for (const id of newParams) {
        const key = String(id);
        newResults[key] = oldResults[key] !== undefined ? oldResults[key] : newLimits[id]?.low_limit ?? 0;
      }

      otherGroup.config_data = {
        ...otherData,
        fuelParams: newParams,
        fuelLimits: newLimits,
        fuelResults: newResults,
        otherSettings: otherData.otherSettings || {},
      };
    } else {
      otherGroup.config_data = {
        ...otherData,
        fuelParams: newParams,
        fuelLimits: newLimits,
        otherSettings: otherData.otherSettings || {},
      };
    }

    await this.configRepo.save(otherGroup);
  }

  return { data: group.config_data };
}


// ===================== 删除选中燃料 =====================
async deleteSelectedFuels(
  user: User,
  moduleName: string,
  removeIds: number[],
) {
  const group = await this.getOrCreateUserGroup(user, moduleName);
  const configData = _.cloneDeep(group.config_data || {});

  const oldParams: number[] = configData.fuelParams || [];
  const oldLimits: Record<string, any> = configData.fuelLimits || {};

  const newParams = oldParams.filter(id => !removeIds.includes(id));

  const newLimits: Record<string, any> = {};
  Object.keys(oldLimits).forEach(id => {
    if (!removeIds.includes(Number(id))) newLimits[id] = oldLimits[id];
  });

  group.config_data = {
    ...configData,
    fuelParams: newParams,
    fuelLimits: newLimits,
    otherSettings: configData.otherSettings || {},
  };
  await this.configRepo.save(group);

  // 🔧 跨模块同步（含生铁固定配料计算）
  const allModules = [
    '单独高炉配料计算',
    '铁前一体化配料计算I',
    '铁前一体化配料计算II',
    '利润一体化配料计算',
    '生铁固定配料计算',
  ];
  const otherModules = allModules.filter(m => m !== moduleName);

  for (const other of otherModules) {
    const otherGroup = await this.getOrCreateUserGroup(user, other);
    const otherData = _.cloneDeep(otherGroup.config_data || {});

    if (other === '生铁固定配料计算') {
      const oldResults: Record<string, number> = otherData.fuelResults || {};
      const newResults: Record<string, number> = {};

      for (const id of newParams) {
        const key = String(id);
        if (oldResults[key] !== undefined) newResults[key] = oldResults[key];
      }

      otherGroup.config_data = {
        ...otherData,
        fuelParams: newParams,
        fuelLimits: newLimits,
        fuelResults: newResults,
        otherSettings: otherData.otherSettings || {},
      };
    } else {
      otherGroup.config_data = {
        ...otherData,
        fuelParams: newParams,
        fuelLimits: newLimits,
        otherSettings: otherData.otherSettings || {},
      };
    }

    await this.configRepo.save(otherGroup);
  }

  return { data: group.config_data };
}



  // ===================== 保存完整配置 =====================
// ===================== 保存完整参数组 =====================
// ===================== 保存完整配置 =====================
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
  const existingData = _.cloneDeep(group.config_data || {});

  // 每个模块允许同步的 otherSettings 字段
  const OTHER_SETTING_WHITELIST: Record<string, string[]> = {
    '单独高炉配料计算': ['固定配比', '煤比选择', '焦丁比选择'],
    '铁前一体化配料计算I': ['固定配比', '煤比选择', '焦丁比选择', '变量选择'],
    '铁前一体化配料计算II': ['固定配比', '煤比选择', '焦丁比选择', '变量选择'],
    '利润一体化配料计算': ['固定配比', '煤比选择', '焦丁比选择', '变量选择'],
    '生铁固定配料计算': ['煤比选择', '焦丁比选择'], // ✅ 新增
  };

  // 公共同步字段
  const syncCommonData: Record<string, any> = {};
  if (ingredientLimits) syncCommonData.ingredientLimits = ingredientLimits;
  if (fuelLimits) syncCommonData.fuelLimits = fuelLimits;
  if (slagLimits) syncCommonData.slagLimits = slagLimits;
  if (hotMetalRatio) syncCommonData.hotMetalRatio = hotMetalRatio;
  if (loadTopLimits) syncCommonData.loadTopLimits = loadTopLimits;
  if (ironWaterTopLimits) syncCommonData.ironWaterTopLimits = ironWaterTopLimits;

  // 当前模块保存自己全部 otherSettings（非同步字段也保留）
  const currentWhitelist = OTHER_SETTING_WHITELIST[moduleName] || [];
  const currentOtherSettings: Record<string, any> = {};
  if (otherSettings) {
    for (const key of Object.keys(otherSettings)) {
      currentOtherSettings[key] = otherSettings[key]; // 当前模块全保存
    }
  }

  group.config_data = {
    ...existingData,
    ...syncCommonData,
    otherSettings: {
      ...(existingData.otherSettings || {}),
      ...currentOtherSettings,
    },
  };

  await this.configRepo.save(group);

  // 跨模块同步，只同步字段在目标模块白名单里的字段
  const allModules = Object.keys(OTHER_SETTING_WHITELIST);
  const otherModules = allModules.filter(m => m !== moduleName);

  for (const other of otherModules) {
    const otherGroup = await this.getOrCreateUserGroup(user, other);
    const otherData = _.cloneDeep(otherGroup.config_data || {});
    const targetWhitelist = OTHER_SETTING_WHITELIST[other] || [];

    const syncedOtherSettings: Record<string, any> = {};
    if (otherSettings) {
      for (const key of Object.keys(otherSettings)) {
        if (targetWhitelist.includes(key)) {
          syncedOtherSettings[key] = otherSettings[key];
        }
      }
    }

    const newConfig: Record<string, any> = {
      ...otherData,
      ...syncCommonData,
      otherSettings: {
        ...(otherData.otherSettings || {}),
        ...syncedOtherSettings,
      },
    };

    // ⭐ 生铁固定配料计算模块特殊处理：保留 ingredientResults & fuelResults
    if (other === '生铁固定配料计算') {
      newConfig.ingredientResults = otherData.ingredientResults || {};
      newConfig.fuelResults = otherData.fuelResults || {};
    }

    otherGroup.config_data = newConfig;
    await this.configRepo.save(otherGroup);
  }

  return group;
}


private toNumber(val: any): number {
  const num = Number(val);
  return isNaN(num) ? 0 : num;
}

private calcUnitCost(item: any) {
  if (item?.项目分类 === '动力费用') {
    const price = this.toNumber(item.价格);
    const usage = this.toNumber(item.单位用量);
    return {
      ...item,
      单位成本: +(price * usage).toFixed(4),
    };
  }
  return item;
}

private calcTotalCost(map: Record<string, any>) {
  return +Object.values(map)
    .reduce((sum, item: any) => sum + this.toNumber(item?.单位成本), 0)
    .toFixed(4);
}

private toTableArray(map: Record<string, any>) {
  return Object.entries(map).map(([name, val]) => ({
    name,
    ...val,
  }));
}

async addGLProcessCost(
  user: User,
  items: Record<string, any>,
) {
  const baseModule = '单独高炉配料计算';
  const group = await this.getOrCreateUserGroup(user, baseModule);

  const origin = group.config_data?.GLProcessCost || {};
  const newItems: Record<string, any> = {};

  for (const key of Object.keys(items)) {
    if (origin[key]) {
      throw new Error(`项目【${key}】已存在`);
    }
    newItems[key] = this.calcUnitCost(items[key]);
  }

  const merged = { ...origin, ...newItems };
  return this.syncGLProcessCost(user, merged, '新增成功');
}
async updateGLProcessCost(
  user: User,
  key: string,
  payload: Record<string, any>,
) {
  const baseModule = '单独高炉配料计算';
  const group = await this.getOrCreateUserGroup(user, baseModule);

  const map = group.config_data?.GLProcessCost || {};
  if (!map[key]) {
    throw new Error(`项目【${key}】不存在`);
  }

  map[key] = this.calcUnitCost({ ...map[key], ...payload });
  return this.syncGLProcessCost(user, map, '更新成功');
}
async deleteGLProcessCost(
  user: User,
  keys: string[],
) {
  const baseModule = '单独高炉配料计算';
  const group = await this.getOrCreateUserGroup(user, baseModule);

  const map = { ...(group.config_data?.GLProcessCost || {}) };
  keys.forEach(k => delete map[k]);

  return this.syncGLProcessCost(user, map, '删除成功', keys);
}

async getGLProcessCostList(
  user: User,
  page = 1,
  pageSize = 10,
  keyword?: string,
) {
  const group = await this.getOrCreateUserGroup(user, '单独高炉配料计算');
  const map = group.config_data?.GLProcessCost || {};

  let list = this.toTableArray(map);
  if (keyword) list = list.filter(i => i.name.includes(keyword));

  const total = list.length;
  return {
    data: list.slice((page - 1) * pageSize, page * pageSize),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}
private async syncGLProcessCost(
  user: User,
  glProcessCost: Record<string, any>,
  message: string,
  deleted: string[] = [],
) {
  const totalCost = this.calcTotalCost(glProcessCost);

  const modules = [
    '单独高炉配料计算',
    '铁前一体化配料计算I',
    '铁前一体化配料计算II',
    '利润一体化配料计算',
  ];

  for (const moduleName of modules) {
    const group = await this.getOrCreateUserGroup(user, moduleName);
    const data = _.cloneDeep(group.config_data || {});

    if (!data.otherSettings) data.otherSettings = {};
    data.otherSettings['其他费用'] = totalCost;

    group.config_data = {
      ...data,
      GLProcessCost: glProcessCost,
      otherSettings: data.otherSettings,
    };

    await this.configRepo.save(group);
  }

  return {
    success: true,
    message: `高炉工序成本${message}`,
    ...(deleted.length ? { deleted } : {}),
    data: {
      list: this.toTableArray(glProcessCost),
      totalCost,
    },
  };
}

// ============================================================
// 🔥 内置矿粉配比（BuiltinPowder）
// ============================================================
// 说明：内置矿粉配比存储在 config_data.BuiltinPowder 中，用于在选择高炉原料时自动设置上下限
// 数据结构：{ "BuiltinPowder": { "物料名称": { "name": "物料名称", "top_limit": 80, "low_limit": 0 } } }
// 注意：高炉的内置矿粉配比数据保存在'单独高炉配料计算'模块中

/**
 * 新增/批量新增内置矿粉配比
 * @param user 当前用户
 * @param items 要新增的内置矿粉配比项数组，包含物料名称、上限、下限
 * @returns 返回操作结果和完整的BuiltinPowder数据
 */
async addBuiltinPowder(
  user: User,
  items: Array<{ name: string; top_limit: number; low_limit: number }>,
) {
  const group = await this.getOrCreateUserGroup(user, '单独高炉配料计算');
  const config = group.config_data || {};
  
  if (!config.BuiltinPowder) {
    config.BuiltinPowder = {};
  }

  // 1️⃣ 防重复 name
  for (const item of items) {
    if (config.BuiltinPowder[item.name]) {
      throw new BadRequestException(`物料【${item.name}】已存在，不能重复添加`);
    }
    config.BuiltinPowder[item.name] = {
      name: item.name,
      top_limit: item.top_limit,
      low_limit: item.low_limit,
    };
  }

  group.config_data = config;
  await this.configRepo.save(group);

  return {
    success: true,
    message: '内置矿粉配比新增成功',
    data: config.BuiltinPowder,
  };
}

/**
 * 更新单个内置矿粉配比
 * @param user 当前用户
 * @param key 要更新的物料名称（作为key）
 * @param payload 更新的内容，可以更新name、top_limit、low_limit
 * @returns 返回操作结果和更新后的数据
 * @throws Error 如果物料不存在或新名称已存在
 */
async updateBuiltinPowder(
  user: User,
  key: string,
  payload: { name?: string; top_limit?: number; low_limit?: number },
) {
  const group = await this.getOrCreateUserGroup(user, '单独高炉配料计算');
  const config = group.config_data || {};

  if (!config.BuiltinPowder || !config.BuiltinPowder[key]) {
    throw new BadRequestException(`物料【${key}】不存在`);
  }

  // 如果更新了 name，需要检查新 name 是否已存在
  let finalKey = key; // 最终返回的key
  if (payload.name && payload.name !== key) {
    if (config.BuiltinPowder[payload.name]) {
      throw new BadRequestException(`物料【${payload.name}】已存在，不能重复`);
    }
    // 删除旧的 key，添加新的 name
    const oldData = config.BuiltinPowder[key];
    delete config.BuiltinPowder[key];
    config.BuiltinPowder[payload.name] = {
      ...oldData,
      ...payload,
      name: payload.name,
    };
    finalKey = payload.name; // 更新最终返回的key
  } else {
    // 更新现有项
    config.BuiltinPowder[key] = {
      ...config.BuiltinPowder[key],
      ...payload,
    };
  }

  group.config_data = config;
  await this.configRepo.save(group);

  return {
    success: true,
    message: '内置矿粉配比更新成功',
    data: config.BuiltinPowder[finalKey],
  };
}

/**
 * 批量删除内置矿粉配比
 * @param user 当前用户
 * @param keys 要删除的物料名称数组
 * @returns 返回操作结果和删除后的完整BuiltinPowder数据
 */
async deleteBuiltinPowder(
  user: User,
  keys: string[],
) {
  const group = await this.getOrCreateUserGroup(user, '单独高炉配料计算');
  const config = group.config_data || {};

  if (!config.BuiltinPowder) {
    config.BuiltinPowder = {};
  }

  keys.forEach(key => {
    delete config.BuiltinPowder[key];
  });

  group.config_data = config;
  await this.configRepo.save(group);

  return {
    success: true,
    message: '内置矿粉配比删除成功',
    data: config.BuiltinPowder,
  };
}

/**
 * 分页获取内置矿粉配比列表
 * @param user 当前用户
 * @param page 页码，默认1
 * @param pageSize 每页数量，默认10
 * @param keyword 物料名称关键字搜索（可选）
 * @returns 返回分页后的列表数据
 */
async getBuiltinPowderList(
  user: User,
  page = 1,
  pageSize = 10,
  keyword?: string,
) {
  const group = await this.getOrCreateUserGroup(user, '单独高炉配料计算');
  const builtinPowderMap: Record<string, any> = group.config_data?.BuiltinPowder || {};

  let list = Object.entries(builtinPowderMap).map(([name, val]) => ({
    name,
    ...val,
  }));

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

/**
 * 根据物料名称获取内置矿粉配比（用于选择高炉原料时判断）
 * @param user 当前用户
 * @param materialName 物料名称
 * @returns 如果找到则返回上下限，否则返回null
 */
async getBuiltinPowderByName(
  user: User,
  materialName: string,
): Promise<{ top_limit: number; low_limit: number } | null> {
  const group = await this.getOrCreateUserGroup(user, '单独高炉配料计算');
  const builtinPowderMap: Record<string, any> = group.config_data?.BuiltinPowder || {};

  const item = builtinPowderMap[materialName];
  if (item) {
    return {
      top_limit: item.top_limit,
      low_limit: item.low_limit,
    };
  }

  return null;
}

}
