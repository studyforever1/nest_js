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
    // 1️⃣ 获取当前模块用户组
    const group = await this.getOrCreateUserGroup(user, moduleName);
    const moduleData = _.cloneDeep(group.config_data);

    // 2️⃣ 获取公共参数模块（可以是任意模块，比如 “铁前一体化配料计算I”）
    const commonModuleName = '铁前一体化配料计算I'; 
    const commonGroup = await this.getOrCreateUserGroup(user, commonModuleName);
    const commonData = _.cloneDeep(commonGroup.config_data);

    // 公共参数
    const publicKeys = ['ingredientLimits','fuelLimits','slagLimits','hotMetalRatio','loadTopLimits','ironWaterTopLimits'];
    const configData: Record<string, any> = {};

    publicKeys.forEach(key => {
        configData[key] = commonData[key] || {};
    });

    // 3️⃣ 模块专属 otherSettings
    configData.otherSettings = moduleData.otherSettings || {};

    // 4️⃣ 为 ingredientLimits 附加 name
    const ingredientLimits = configData.ingredientLimits;
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

    // 5️⃣ 为 fuelLimits 附加 name/type
    const fuelLimits = configData.fuelLimits;
    const fuelIds = Object.keys(fuelLimits).map(id => Number(id));
    const coalSelected = configData.otherSettings?.["煤比选择"];
    const jiaodingSelected = configData.otherSettings?.["焦丁比选择"];
    if (fuelIds.length) {
        const fuels = await this.fuelRepo.findByIds(fuelIds);
        const limitsWithName: Record<string, any> = {};
        fuels.forEach(f => {
            if (fuelLimits[f.id]) {
                let type = "";
                if (String(f.id) === String(coalSelected)) type = "煤比";
                else if (String(f.id) === String(jiaodingSelected)) type = "焦丁比";

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
  const group = await this.getOrCreateUserGroup(user, moduleName);
  const configData = _.cloneDeep(group.config_data || {});

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
  const newOtherSettings = { ...configData.otherSettings };

  if (!isEmptyReset) {
    if (cleanCat || cleanName) {
      let qb = this.rawRepo.createQueryBuilder('raw').where('raw.id IN (:...ids)', { ids: oldParams });
      if (cleanCat) qb = qb.andWhere('raw.category LIKE :cat', { cat: `${cleanCat}%` });
      if (cleanName) qb = qb.andWhere('raw.name LIKE :nm', { nm: `%${cleanName}%` });

      const oldCategoryIds = (await qb.getMany()).map(r => r.id);
      const toRemove = oldCategoryIds.filter(id => !selectedIds.includes(id));
      const toAdd = selectedIds.filter(id => !oldCategoryIds.includes(id));

      oldParams.forEach(id => {
        if (!toRemove.includes(id) && !toAdd.includes(id) && oldLimits[id]) {
          newLimits[id] = oldLimits[id];
        }
      });

      if (toAdd.length) {
        const addRaws = await this.rawRepo.find({ where: { id: In(toAdd) } });
        addRaws.forEach(r => newLimits[r.id] = { low_limit: 0, top_limit: 100 });
        addRaws.forEach(r => {
          if (r.category?.startsWith('K')) newOtherSettings['块矿'].push(r.id);
        });
      }

      newParams = [...oldParams.filter(id => !toRemove.includes(id)), ...toAdd];

    } else {
      const raws = selectedIds.length ? await this.rawRepo.find({ where: { id: In(selectedIds) } }) : [];
      raws.forEach(r => newLimits[r.id] = oldLimits[r.id] || { low_limit: 0, top_limit: 100 });
      newParams = raws.map(r => r.id);
      newOtherSettings['块矿'] = raws.filter(r => r.category?.startsWith('K')).map(r => r.id);
    }
  }

  // 删除固定配比中已移除的原料
  if (Array.isArray(newOtherSettings['固定配比'])) {
    newOtherSettings['固定配比'] = newOtherSettings['固定配比'].filter(id => newParams.includes(Number(id)));
  }

  // 保存当前模块
  group.config_data = {
    ...configData,
    ingredientParams: newParams,
    ingredientLimits: newLimits,
    otherSettings: newOtherSettings,
  };
  await this.configRepo.save(group);

  // 同步到其他模块
  const allModules = [
    '单独高炉配料计算',
    '铁前一体化配料计算I',
    '铁前一体化配料计算II',
    '利润一体化配料计算',
  ];
  const otherModules = allModules.filter(m => m !== moduleName);

  for (const other of otherModules) {
    const otherGroup = await this.getOrCreateUserGroup(user, other);
    const otherData = _.cloneDeep(otherGroup.config_data || {});
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
    await this.configRepo.save(otherGroup);
  }

  // 返回当前模块完整配置
  return { data: group.config_data };
}

// ===================== 删除选中原料 =====================
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

  const newOtherSettings = { ...configData.otherSettings };

  if (Array.isArray(newOtherSettings['块矿'])) {
    newOtherSettings['块矿'] = newOtherSettings['块矿'].filter(id => !removeIds.includes(Number(id)));
  }

  if (Array.isArray(newOtherSettings['固定配比'])) {
    newOtherSettings['固定配比'] = newOtherSettings['固定配比'].filter(id => newParams.includes(Number(id)));
  }

  group.config_data = { ...configData, ingredientParams: newParams, ingredientLimits: newLimits, otherSettings: newOtherSettings };
  await this.configRepo.save(group);

  // 同步到其他模块
  const allModules = [
    '单独高炉配料计算',
    '铁前一体化配料计算I',
    '铁前一体化配料计算II',
    '利润一体化配料计算',
  ];
  const otherModules = allModules.filter(m => m !== moduleName);

  for (const other of otherModules) {
    const otherGroup = await this.getOrCreateUserGroup(user, other);
    const otherData = _.cloneDeep(otherGroup.config_data || {});
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
    await this.configRepo.save(otherGroup);
  }

  return { data: group.config_data };
}




// ===================== 燃料 =====================
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

  let newLimits: Record<string, any> = {};
  let newParams: number[] = [];

  if (!isEmptyReset) {
    if (cleanCat || cleanName) {
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
        addFuels.forEach(f => newLimits[f.id] = { low_limit: 0, top_limit: 100 });
      }

      newParams = [...oldParams.filter(id => !toRemove.includes(id)), ...toAdd];
    } else {
      const fuels = selectedIds.length ? await this.fuelRepo.find({ where: { id: In(selectedIds) } }) : [];
      fuels.forEach(f => newLimits[f.id] = oldLimits[f.id] || { low_limit: 0, top_limit: 100 });
      newParams = fuels.map(f => f.id);
    }
  }

  // 保存当前模块
  group.config_data = {
    ...configData,
    fuelParams: newParams,
    fuelLimits: newLimits,
    // 不修改 otherSettings
  };
  await this.configRepo.save(group);

  // 跨模块同步 fuelParams 和 fuelLimits
  const allModules = [
    '单独高炉配料计算',
    '铁前一体化配料计算I',
    '铁前一体化配料计算II',
    '利润一体化配料计算',
  ];
  const otherModules = allModules.filter(m => m !== moduleName);

  for (const other of otherModules) {
    const otherGroup = await this.getOrCreateUserGroup(user, other);
    const otherData = _.cloneDeep(otherGroup.config_data || {});

    otherGroup.config_data = {
      ...otherData,
      fuelParams: newParams,
      fuelLimits: newLimits,
      // 保留原有 otherSettings
      otherSettings: otherData.otherSettings || {},
    };

    await this.configRepo.save(otherGroup);
  }

  return {data: group.config_data };
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

  // 保存当前模块
  group.config_data = {
    ...configData,
    fuelParams: newParams,
    fuelLimits: newLimits,
    otherSettings: configData.otherSettings || {}, // 不修改
  };
  await this.configRepo.save(group);

  // 跨模块同步
  const allModules = [
    '单独高炉配料计算',
    '铁前一体化配料计算I',
    '铁前一体化配料计算II',
    '利润一体化配料计算',
  ];
  const otherModules = allModules.filter(m => m !== moduleName);

  for (const other of otherModules) {
    const otherGroup = await this.getOrCreateUserGroup(user, other);
    const otherData = _.cloneDeep(otherGroup.config_data || {});

    otherGroup.config_data = {
      ...otherData,
      fuelParams: newParams,
      fuelLimits: newLimits,
      otherSettings: otherData.otherSettings || {}, // 保留原有
    };

    await this.configRepo.save(otherGroup);
  }

  return {data: group.config_data };
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

  /** ------------------------------------
   * 0️⃣ 定义：各模块允许同步的 otherSettings 字段
   * ------------------------------------ */
  const OTHER_SETTING_WHITELIST: Record<string, string[]> = {
    '单独高炉配料计算': [
      '固定配比',
      '煤比选择',
      '焦丁比选择',
    ],

    '铁前一体化配料计算I': [
      '固定配比',
      '煤比选择',
      '焦丁比选择',
      '变量选择',
    ],

    '铁前一体化配料计算II': [
      '固定配比',
      '煤比选择',
      '焦丁比选择',
      '变量选择',
    ],

    '利润一体化配料计算': [
      '固定配比',
      '煤比选择',
      '焦丁比选择',
      '变量选择',
    ],
  };

  /** ------------------------------------
   * 1️⃣ 公共同步字段（和模块无关）
   * ------------------------------------ */
  const syncCommonData: Record<string, any> = {};
  if (ingredientLimits) syncCommonData.ingredientLimits = ingredientLimits;
  if (fuelLimits) syncCommonData.fuelLimits = fuelLimits;
  if (slagLimits) syncCommonData.slagLimits = slagLimits;
  if (hotMetalRatio) syncCommonData.hotMetalRatio = hotMetalRatio;
  if (loadTopLimits) syncCommonData.loadTopLimits = loadTopLimits;
  if (ironWaterTopLimits) syncCommonData.ironWaterTopLimits = ironWaterTopLimits;

  /** ------------------------------------
   * 2️⃣ 当前模块：按自身白名单保存 otherSettings
   * ------------------------------------ */
  const currentWhitelist = OTHER_SETTING_WHITELIST[moduleName] || [];
  const currentOtherSettings: Record<string, any> = {};

  if (otherSettings) {
    for (const key of currentWhitelist) {
      if (key in otherSettings) {
        currentOtherSettings[key] = otherSettings[key]; // 空数组也允许
      }
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

  /** ------------------------------------
   * 3️⃣ 同步到其他模块（按“目标模块白名单”裁剪）
   * ------------------------------------ */
  const allModules = Object.keys(OTHER_SETTING_WHITELIST);
  const otherModules = allModules.filter(m => m !== moduleName);

  for (const other of otherModules) {
    const otherGroup = await this.getOrCreateUserGroup(user, other);
    const otherData = _.cloneDeep(otherGroup.config_data || {});

    const targetWhitelist = OTHER_SETTING_WHITELIST[other] || [];
    const syncedOtherSettings: Record<string, any> = {};

    if (otherSettings) {
      for (const key of targetWhitelist) {
        if (key in otherSettings) {
          syncedOtherSettings[key] = otherSettings[key];
        }
      }
    }

    otherGroup.config_data = {
      ...otherData,
      ...syncCommonData,
      otherSettings: {
        ...(otherData.otherSettings || {}),
        ...syncedOtherSettings,
      },
    };

    await this.configRepo.save(otherGroup);
  }

  return group;
}



}
