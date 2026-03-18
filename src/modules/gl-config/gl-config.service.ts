import { Injectable, Logger, BadRequestException,NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import _ from 'lodash';

import { ConfigGroup } from '../../database/entities/config-group.entity';
import { BizModule } from '../../database/entities/biz-module.entity';
import { User } from '../user/entities/user.entity';
import { GlMaterialInfo } from '../gl-material-info/entities/gl-material-info.entity';
import { GlFuelInfo } from '../gl-fuel-info/entities/gl-fuel-info.entity';
import { FIXED_HEADERS as MATERIAL_FIXED_HEADERS } from '../gl-material-info/gl-material-info.service';
import { FIXED_HEADERS as FUEL_FIXED_HEADERS } from '../gl-fuel-info/gl-fuel-info.service';
import { UpdateSelectedIngredientDataDto } from './dto/update-selected-ingredient-data.dto';
import { UpdateSelectedFuelDataDto } from './dto/update-selected-fuel-data.dto';
import * as XLSX from 'xlsx-js-style';

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((o, key) => (o ? o[key] : undefined), obj);
}

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


  /** 规范化composition（物料） */
  private normalizeMaterialComposition(composition?: Record<string, number>): Record<string, number> {
    const result: Record<string, number> = {};
    MATERIAL_FIXED_HEADERS.forEach((key) => {
      result[key] = composition?.[key] ?? 0;
    });
    return result;
  }

  /** 规范化composition（燃料） */
  private normalizeFuelComposition(composition?: Record<string, number>): Record<string, number> {
    const result: Record<string, number> = {};
    FUEL_FIXED_HEADERS.forEach((key) => {
      result[key] = composition?.[key] ?? 0;
    });
    return result;
  }

  /** 排序字段映射（物料） */
  private readonly MATERIAL_SORT_FIELD_MAP: Record<string, string> = {
    name: 'raw.name',
    category: 'raw.category',
    inventory: 'raw.inventory',
    'composition.TFe': "JSON_EXTRACT(raw.composition, '$.TFe')",
    'composition.返矿价格': "JSON_EXTRACT(raw.composition, '$.返矿价格')",
    'composition.干基价格': "JSON_EXTRACT(raw.composition, '$.干基价格')",
  };

  /** 排序字段映射（燃料） */
  private readonly FUEL_SORT_FIELD_MAP: Record<string, string> = {
    name: 'fuel.name',
    category: 'fuel.category',
    inventory: 'fuel.inventory',
    'composition.TFe': "JSON_EXTRACT(fuel.composition, '$.TFe')",
    'composition.返焦价格': "JSON_EXTRACT(fuel.composition, '$.返焦价格')",
    'composition.干基价格': "JSON_EXTRACT(fuel.composition, '$.干基价格')",
  };


async getSelectedIngredients(options: {
  user: User;
  moduleName: string;
  page?: number;
  pageSize?: number;
  name?: string;
  type?: string;
  sort?: string;        // 支持 composition.TFe 这种嵌套字段
  order?: 'asc' | 'desc';
}) {
  const { user, moduleName, page = 1, pageSize = 10, name, type, sort, order } = options;

  const group = await this.getOrCreateUserGroup(user, moduleName);
  const ingredientData: any[] = group.config_data?.ingredientData || [];

  if (!ingredientData.length) {
    return { data: [], total: 0, page, pageSize, totalPages: 0 };
  }

  // 1️⃣ 按 name / type 过滤
  let filteredData = ingredientData;
  if (name) {
    const keyword = name.trim().toLowerCase();
    filteredData = filteredData.filter(item => item.name?.toLowerCase().includes(keyword));
  }
  if (type) {
    const typeKeyword = type.trim().toLowerCase();
    filteredData = filteredData.filter(item => item.category?.toLowerCase().includes(typeKeyword));
  }

  // 2️⃣ 排序
  if (sort) {
    filteredData.sort((a, b) => {
      const aVal = getNestedValue(a, sort);
      const bVal = getNestedValue(b, sort);

      if (aVal == null) return 1;
      if (bVal == null) return -1;

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return order === 'desc' ? bVal - aVal : aVal - bVal;
      }
      return order === 'desc'
        ? String(bVal).localeCompare(String(aVal))
        : String(aVal).localeCompare(String(bVal));
    });
  } else {
    // 默认按 id 升序
    filteredData.sort((a, b) => a.id - b.id);
  }

  // 3️⃣ 分页
  const total = filteredData.length;
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const pageData = filteredData.slice(start, end);

  // 4️⃣ 返回结果
  return {
    data: pageData.map(item => ({
      ...item,
      composition: this.normalizeMaterialComposition(item.composition),
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

 // ===================== 修改单条原料 =====================
async updateSelectedIngredientData(
  user: User,
  moduleName: string,
  id: number,
  dto: UpdateSelectedIngredientDataDto,
  username: string,
) {
  const group = await this.getOrCreateUserGroup(user, moduleName);
  const configData = _.cloneDeep(group.config_data || {});
  const ingredientDataArray = configData.ingredientData || [];
  const ingredientMap: Record<number, any> = {};
  ingredientDataArray.forEach(item => { ingredientMap[item.id] = item; });

  const existing = ingredientMap[id];
  if (!existing) throw new NotFoundException('原料未被选中，无法修改');

  ingredientMap[id] = {
    ...existing,
    name: dto.name ?? existing.name,
    category: dto.category ?? existing.category,
    origin: dto.origin ?? existing.origin,
    remark: dto.remark ?? existing.remark,
    inventory: dto.inventory ?? existing.inventory,
    composition: dto.composition
      ? { ...existing.composition, ...dto.composition }
      : existing.composition,
    modifier: username,
    enabled: dto.enabled ?? existing.enabled,
    updated_at: new Date(),
  };

  configData.ingredientData = Object.values(ingredientMap);
  group.config_data = configData;
  await this.configRepo.save(group);

  // 🔹 跨模块同步
  await this.syncIngredientDataAcrossModules(user, moduleName, configData.ingredientData, configData.ingredientParams);

  return ingredientMap[id];
}

// ===================== 批量恢复原料 =====================
async restoreSelectedIngredients(user: User, moduleName: string, ids: number[]) {
  const group = await this.getOrCreateUserGroup(user, moduleName);
  const configData = _.cloneDeep(group.config_data || {});
  const ingredientParams: number[] = configData.ingredientParams || [];
  const restoreIds = ids.length ? ids : ingredientParams;
  if (!restoreIds.length) return [];

  const raws = await this.rawRepo.findByIds(restoreIds);
  const ingredientData: any[] = configData.ingredientData || [];

  raws.forEach(raw => {
    const index = ingredientData.findIndex(item => item.id === raw.id);
    const newData = { ...raw, composition: this.normalizeMaterialComposition(raw.composition) };
    if (index >= 0) ingredientData[index] = newData;
    else ingredientData.push(newData);
  });

  configData.ingredientData = ingredientData;
  group.config_data = configData;
  await this.configRepo.save(group);

  // 🔹 跨模块同步
  await this.syncIngredientDataAcrossModules(user, moduleName, ingredientData, configData.ingredientParams);

  return ingredientData.filter(item => restoreIds.includes(item.id));
}

// ===================== 修改单条燃料 =====================
async updateSelectedFuelData(
  user: User,
  moduleName: string,
  id: number,
  dto: UpdateSelectedFuelDataDto,
  username: string,
) {
  const group = await this.getOrCreateUserGroup(user, moduleName);
  const configData = _.cloneDeep(group.config_data || {});
  const fuelDataArray = configData.fuelData || [];
  const fuelMap: Record<number, any> = {};
  fuelDataArray.forEach(item => { fuelMap[item.id] = item; });

  const existing = fuelMap[id];
  if (!existing) throw new NotFoundException('燃料未被选中，无法修改');

  fuelMap[id] = {
    ...existing,
    name: dto.name ?? existing.name,
    category: dto.category ?? existing.category,
    remark: dto.remark ?? existing.remark,
    inventory: dto.inventory ?? existing.inventory,
    composition: dto.composition
      ? { ...existing.composition, ...dto.composition }
      : existing.composition,
    modifier: username,
    enabled: dto.enabled ?? existing.enabled,
    updated_at: new Date(),
  };

  configData.fuelData = Object.values(fuelMap);
  group.config_data = configData;
  await this.configRepo.save(group);

  // 🔹 跨模块同步
  await this.syncFuelDataAcrossModules(user, moduleName, configData.fuelData, configData.fuelParams);

  return fuelMap[id];
}

// ===================== 批量恢复燃料 =====================
async restoreSelectedFuels(user: User, moduleName: string, ids: number[]) {
  const group = await this.getOrCreateUserGroup(user, moduleName);
  const configData = _.cloneDeep(group.config_data || {});
  const fuelParams: number[] = configData.fuelParams || [];
  const restoreIds = ids.length ? ids : fuelParams;
  if (!restoreIds.length) return [];

  const fuels = await this.fuelRepo.findByIds(restoreIds);
  const fuelData: any[] = configData.fuelData || [];

  fuels.forEach(f => {
    const index = fuelData.findIndex(item => item.id === f.id);
    const newData = { ...f, composition: this.normalizeFuelComposition(f.composition) };
    if (index >= 0) fuelData[index] = newData;
    else fuelData.push(newData);
  });

  configData.fuelData = fuelData;
  group.config_data = configData;
  await this.configRepo.save(group);

  // 🔹 跨模块同步
  await this.syncFuelDataAcrossModules(user, moduleName, fuelData, configData.fuelParams);

  return fuelData.filter(item => restoreIds.includes(item.id));
}

// ===================== 跨模块同步辅助方法 =====================
private readonly ALL_MODULES = [
  '单独高炉配料计算',
  '铁前一体化配料计算I',
  '铁前一体化配料计算II',
  '利润一体化配料计算',
  '生铁固定配料计算',
];

private async syncIngredientDataAcrossModules(
  user: User,
  moduleName: string,
  ingredientData: any[],
  ingredientParams: number[],
) {
  const otherModules = this.ALL_MODULES.filter(m => m !== moduleName);

  for (const other of otherModules) {
    const otherGroup = await this.getOrCreateUserGroup(user, other);
    const otherData = _.cloneDeep(otherGroup.config_data || {});

    if (other === '生铁固定配料计算') {
      const oldResults: Record<string, number> = otherData.ingredientResults || {};
      const newResults: Record<string, number> = {};
      for (const id of ingredientParams) {
        newResults[String(id)] = oldResults[String(id)] ?? 0;
      }

      otherGroup.config_data = {
        ...otherData,
        ingredientParams,
        ingredientData,
        ingredientResults: newResults,
        otherSettings: otherData.otherSettings || {},
      };
    } else {
      otherGroup.config_data = {
        ...otherData,
        ingredientParams,
        ingredientData,
        otherSettings: otherData.otherSettings || {},
      };
    }

    await this.configRepo.save(otherGroup);
  }
}

private async syncFuelDataAcrossModules(
  user: User,
  moduleName: string,
  fuelData: any[],
  fuelParams: number[],
) {
  const otherModules = this.ALL_MODULES.filter(m => m !== moduleName);

  for (const other of otherModules) {
    const otherGroup = await this.getOrCreateUserGroup(user, other);
    const otherData = _.cloneDeep(otherGroup.config_data || {});

    if (other === '生铁固定配料计算') {
      const oldResults: Record<string, number> = otherData.fuelResults || {};
      const newResults: Record<string, number> = {};
      for (const id of fuelParams) {
        newResults[String(id)] = oldResults[String(id)] ?? 0;
      }

      otherGroup.config_data = {
        ...otherData,
        fuelParams,
        fuelData,
        fuelResults: newResults,
        otherSettings: otherData.otherSettings || {},
      };
    } else {
      otherGroup.config_data = {
        ...otherData,
        fuelParams,
        fuelData,
        otherSettings: otherData.otherSettings || {},
      };
    }

    await this.configRepo.save(otherGroup);
  }
}


async getSelectedFuels(options: {
  user: User;
  moduleName: string;
  page?: number;
  pageSize?: number;
  name?: string;
  type?: string; // 新增 type
  sort?: string; // 可以是 "id"、"name" 或 "composition.TFe" 等嵌套字段
  order?: 'asc' | 'desc';
}) {
  const { user, moduleName, page = 1, pageSize = 10, name, type, sort, order } = options;

  const group = await this.getOrCreateUserGroup(user, moduleName);
  const fuelData: any[] = group.config_data?.fuelData || [];

  if (!fuelData.length) {
    return { data: [], total: 0, page, pageSize, totalPages: 0 };
  }

  // ================= 1️⃣ 名称 / 类型筛选 =================
  let filtered = fuelData.filter(f => {
    let match = true;
    if (name) match = match && f.name.toLowerCase().includes(name.trim().toLowerCase());
    if (type) match = match && f.category.toLowerCase().includes(type.trim().toLowerCase());
    return match;
  });

  // ================= 2️⃣ 排序 =================
  // 支持嵌套字段排序，如 composition.TFe
  const getNestedValue = (obj: any, path: string) => path.split('.').reduce((o, key) => (o ? o[key] : undefined), obj);

  if (sort) {
    filtered.sort((a, b) => {
      const valA = getNestedValue(a, sort);
      const valB = getNestedValue(b, sort);

      if (valA == null) return 1;
      if (valB == null) return -1;

      if (typeof valA === 'number' && typeof valB === 'number') {
        return order === 'desc' ? valB - valA : valA - valB;
      }

      return order === 'desc'
        ? String(valB).localeCompare(String(valA))
        : String(valA).localeCompare(String(valB));
    });
  } else {
    // 默认按 id 升序
    filtered.sort((a, b) => a.id - b.id);
  }

  // ================= 3️⃣ 分页 =================
  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const records = filtered.slice(start, end);

  // ================= 4️⃣ 处理 composition =================
  const data = records.map(item => ({
    ...item,
    composition: this.normalizeFuelComposition(item.composition),
  }));

  return {
    data,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
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

private async calibrateVariableSelection(
  moduleName: string,
  newParams: number[],
  otherSettings: Record<string, any>,
): Promise<string | undefined> {

  const targetModules = [
    '铁前一体化配料计算I',
    '铁前一体化配料计算II',
    '利润一体化配料计算',
  ];

  if (!targetModules.includes(moduleName)) {
    return undefined;
  }

  if (!newParams?.length) {
    return undefined;
  }

  const raws = await this.rawRepo.find({
    where: { id: In(newParams) },
  });

  // ⭐ 1️⃣ 优先烧结矿（强制覆盖）
  const sj = raws.find(r => r.name?.includes('烧结矿'));
  if (sj) {
    return String(sj.id);
  }

  const current = otherSettings?.['变量选择'];

  // ⭐ 2️⃣ 当前变量选择仍合法就保留
  if (current && newParams.includes(Number(current))) {
    return String(current);
  }

  // ⭐ 3️⃣ S 类
  const sCat = raws.find(r => r.category?.startsWith('S'));
  if (sCat) {
    return String(sCat.id);
  }

  // ⭐ 4️⃣ 第一个
  return String(newParams[0]);
}


// ===================== 保存选中原料 =====================
async saveSelectedIngredients(
  user: User,
  moduleName: string,
  selectedIds: number[],
  category?: string,
  name?: string,
) {
  // ================= 1️⃣ 获取或创建当前模块配置 =================
  const group = await this.getOrCreateUserGroup(user, moduleName);
  const configData = _.cloneDeep(group.config_data || {});
  const oldParams: number[] = configData.ingredientParams || [];
  const oldLimits: Record<number, any> = configData.ingredientLimits || {};

  // ================= 2️⃣ 初始化 otherSettings =================
  if (!configData.otherSettings) configData.otherSettings = {};
  if (!Array.isArray(configData.otherSettings['块矿'])) configData.otherSettings['块矿'] = [];
  if (!Array.isArray(configData.otherSettings['固定配比'])) configData.otherSettings['固定配比'] = [];
  if (!Array.isArray(configData.otherSettings['精粉'])) configData.otherSettings['精粉'] = [];

  const cleanCat = category?.trim();
  const cleanName = name?.trim();
  const isCategoryMode = !!cleanCat || !!cleanName;

  const isEmptyReset = (!selectedIds?.length) && !isCategoryMode;

  let newParams: number[] = [];
  let newLimits: Record<number, any> = {};
  const newOtherSettings = _.cloneDeep(configData.otherSettings || {});

  // ================= 3️⃣ 分类/全量处理 =================
  if (!isEmptyReset) {
    if (isCategoryMode) {
      // 分类/名称局部更新
      let qb = this.rawRepo.createQueryBuilder('raw').where('raw.id IN (:...ids)', { ids: oldParams });
      if (cleanCat) qb = qb.andWhere('raw.category LIKE :cat', { cat: `${cleanCat}%` });
      if (cleanName) qb = qb.andWhere('raw.name LIKE :nm', { nm: `%${cleanName}%` });

      const oldCategoryIds = (await qb.getMany()).map(r => r.id);
      const toRemove = oldCategoryIds.filter(id => !selectedIds.includes(id));
      const toAdd = selectedIds.filter(id => !oldCategoryIds.includes(id));

      // 保留未变原料限制
      oldParams.forEach(id => {
        if (!toRemove.includes(id) && !toAdd.includes(id) && oldLimits[id]) {
          newLimits[id] = oldLimits[id];
        }
      });

      // 新增原料限制
      if (toAdd.length) {
        const builtinPowderGroup = await this.getOrCreateUserGroup(user, '单独高炉配料计算');
        const builtinPowderMap: Record<string, any> = builtinPowderGroup.config_data?.BuiltinPowder || {};
        const addRaws = await this.rawRepo.find({ where: { id: In(toAdd) } });

        addRaws.forEach(r => {
          const builtinPowder = builtinPowderMap[r.name];
          newLimits[r.id] = builtinPowder
            ? { low_limit: builtinPowder.low_limit ?? 0, top_limit: builtinPowder.top_limit ?? 100 }
            : { low_limit: 0, top_limit: 100 };

          if (r.category?.startsWith('K')) newOtherSettings['块矿'].push(r.id);
          if (r.category?.startsWith('T1')) newOtherSettings['精粉'].push(String(r.id));
        });
      }

      newParams = Array.from(new Set([...oldParams.filter(id => !toRemove.includes(id)), ...toAdd]));

    } else {
      // 全量替换
      const builtinPowderGroup = await this.getOrCreateUserGroup(user, '单独高炉配料计算');
      const builtinPowderMap: Record<string, any> = builtinPowderGroup.config_data?.BuiltinPowder || {};
      const raws = selectedIds.length ? await this.rawRepo.find({ where: { id: In(selectedIds) } }) : [];

      raws.forEach(r => {
        if (oldLimits[r.id]) {
          newLimits[r.id] = oldLimits[r.id];
        } else {
          const builtinPowder = builtinPowderMap[r.name];
          newLimits[r.id] = builtinPowder
            ? { low_limit: builtinPowder.low_limit ?? 0, top_limit: builtinPowder.top_limit ?? 100 }
            : { low_limit: 0, top_limit: 100 };
        }

        if (r.category?.startsWith('K')) newOtherSettings['块矿'].push(r.id);
        if (r.category?.startsWith('T1')) newOtherSettings['精粉'].push(String(r.id));
      });

      newParams = raws.map(r => r.id);
    }
  }

  // ================= 4️⃣ 清理固定配比/精粉/块矿中过期或重复原料 =================
newOtherSettings['固定配比'] = (newOtherSettings['固定配比'] || [])
  .filter(id => newParams.includes(Number(id)));
newOtherSettings['精粉'] = (newOtherSettings['精粉'] || [])
  .filter(id => newParams.includes(Number(id)));
newOtherSettings['块矿'] = Array.from(new Set(
  (newOtherSettings['块矿'] || []).filter(id => newParams.includes(Number(id)))
));
  // ================= 5️⃣ 自动校准变量选择 =================
  const calibratedValue = await this.calibrateVariableSelection(moduleName, newParams, newOtherSettings);
  if (calibratedValue !== undefined) {
    newOtherSettings['变量选择'] = calibratedValue;
  }

  // ================= 6️⃣ 生成原料快照 =================
  const rawsSnapshot = await this.rawRepo.find({ where: { id: In(newParams) } });
  const ingredientData = rawsSnapshot.map(r => ({
    id: r.id,
    name: r.name,
    category: r.category,
    composition: r.composition,
    inventory: r.inventory,
    origin: r.origin,
    modifier: r.modifier,
    enabled: r.enabled,
    remark: r.remark,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));

  // ================= 7️⃣ 保存当前模块 =================
  group.config_data = {
    ...configData,
    ingredientParams: newParams,
    ingredientLimits: newLimits,
    ingredientData,
    otherSettings: newOtherSettings,
  };
  await this.configRepo.save(group);

  // ================= 8️⃣ 同步其他模块（仅必要字段） =================
  const syncModules = [
    '单独高炉配料计算',
    '铁前一体化配料计算I',
    '铁前一体化配料计算II',
    '利润一体化配料计算',
    '生铁固定配料计算',
  ];

  for (const syncModule of syncModules.filter(m => m !== moduleName)) {
    const otherGroup = await this.getOrCreateUserGroup(user, syncModule);
    const otherData = _.cloneDeep(otherGroup.config_data || {});

    // 同步参数和限制
    otherData.ingredientParams = newParams;
    otherData.ingredientLimits = newLimits;
    otherData.ingredientData = ingredientData;

    // 复制块矿/固定配比
    const syncedOtherSettings = {
      ...(otherData.otherSettings || {}),
      '块矿': newOtherSettings['块矿'],
      '固定配比': newOtherSettings['固定配比'],
    };

    // 仅对铁前/利润模块同步变量选择
    if (['铁前一体化配料计算I','铁前一体化配料计算II','利润一体化配料计算'].includes(syncModule)) {
      const calibrated = await this.calibrateVariableSelection(syncModule, newParams, syncedOtherSettings);
      if (calibrated !== undefined) {
        syncedOtherSettings['变量选择'] = calibrated;
      }
    }

    // 生铁固定配料计算初始化 ingredientResults
    if (syncModule === '生铁固定配料计算') {
      const oldResults: Record<string, number> = otherData.ingredientResults || {};
      const newResults: Record<string, number> = {};
      newParams.forEach(id => {
        const key = String(id);
        newResults[key] = oldResults[key] !== undefined ? oldResults[key] : newLimits[id]?.low_limit ?? 0;
      });

      otherGroup.config_data = {
        ...otherData,
        ingredientParams: newParams,
        ingredientLimits: newLimits,
        ingredientResults: newResults,
        otherSettings: syncedOtherSettings,
      };
    } else {
      otherGroup.config_data = {
        ...otherData,
        ingredientParams: newParams,
        ingredientLimits: newLimits,
        otherSettings: syncedOtherSettings,
      };
    }

    await this.configRepo.save(otherGroup);
  }

  return { data: group.config_data };
}


async deleteSelectedIngredients(
  user: User,
  moduleName: string,
  removeIds: number[],
) {
  const group = await this.getOrCreateUserGroup(user, moduleName);
  const configData = _.cloneDeep(group.config_data || {});

  const oldParams: number[] = configData.ingredientParams || [];
  const oldLimits: Record<string, any> = configData.ingredientLimits || {};
  const oldData: any[] = configData.ingredientData || [];

  // ================= 1️⃣ 更新参数和限制 =================
  const newParams = oldParams.filter(id => !removeIds.includes(id));

  const newLimits: Record<string, any> = {};
  Object.keys(oldLimits).forEach(id => {
    if (!removeIds.includes(Number(id))) newLimits[id] = oldLimits[id];
  });

  // ================= 2️⃣ 更新 otherSettings =================
  const newOtherSettings = _.cloneDeep(configData.otherSettings || {});
  if (Array.isArray(newOtherSettings['块矿'])) {
    newOtherSettings['块矿'] = newOtherSettings['块矿'].filter(id => !removeIds.includes(Number(id)));
  }
  if (Array.isArray(newOtherSettings['固定配比'])) {
    newOtherSettings['固定配比'] = newOtherSettings['固定配比'].filter(id => newParams.includes(Number(id)));
  }
  if (Array.isArray(newOtherSettings['精粉'])) {
    newOtherSettings['精粉'] = newOtherSettings['精粉'].filter(id => newParams.includes(Number(id)));
  }

  // ================= 3️⃣ 删除快照中被移除原料 =================
  const newIngredientData = oldData.filter(raw => !removeIds.includes(raw.id));

  // ================= 4️⃣ 保存当前模块 =================
  group.config_data = {
    ...configData,
    ingredientParams: newParams,
    ingredientLimits: newLimits,
    ingredientData: newIngredientData, // ⭐ 更新快照
    otherSettings: newOtherSettings,
  };
  await this.configRepo.save(group);

  // ================= 5️⃣ 同步到其他模块 =================
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

    // 删除快照中原料
    const otherIngredientData = (otherData.ingredientData || []).filter(raw => !removeIds.includes(raw.id));

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
        ingredientData: otherIngredientData, // ⭐ 更新快照
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
        ingredientData: otherIngredientData, // ⭐ 更新快照
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
  const oldLimits: Record<number, any> = configData.fuelLimits || {};
  const isEmptyReset = (!selectedIds?.length) && !cleanCat && !cleanName;

  let newParams: number[] = [];
  let newLimits: Record<number, any> = {};

  // ================= 1️⃣ 分类/全量处理 =================
  if (!isEmptyReset) {
    if (cleanCat || cleanName) {
      // 局部更新
      let qb = this.fuelRepo.createQueryBuilder('fuel').where('fuel.id IN (:...ids)', { ids: oldParams });
      if (cleanCat) qb = qb.andWhere('fuel.category LIKE :cat', { cat: `${cleanCat}%` });
      if (cleanName) qb = qb.andWhere('fuel.name LIKE :nm', { nm: `%${cleanName}%` });

      const oldCategoryIds = (await qb.getMany()).map(f => f.id);
      const toRemove = oldCategoryIds.filter(id => !selectedIds.includes(id));
      const toAdd = selectedIds.filter(id => !oldCategoryIds.includes(id));

      // 保留未变燃料的限制
      oldParams.forEach(id => {
        if (!toRemove.includes(id) && oldLimits[id]) newLimits[id] = oldLimits[id];
      });

      // 新增燃料限制
      if (toAdd.length) {
        const addFuels = await this.fuelRepo.find({ where: { id: In(toAdd) } });
        addFuels.forEach(f => {
          newLimits[f.id] = { low_limit: 0, top_limit: 100 };
        });
      }

      newParams = Array.from(new Set([...oldParams.filter(id => !toRemove.includes(id)), ...toAdd]));

    } else {
      // 全量替换
      const fuels = selectedIds.length ? await this.fuelRepo.find({ where: { id: In(selectedIds) } }) : [];
      fuels.forEach(f => newLimits[f.id] = oldLimits[f.id] || { low_limit: 0, top_limit: 100 });
      newParams = fuels.map(f => f.id);
    }
  }

  // ================= 2️⃣ 生成燃料快照 =================
  const fuelsSnapshot = await this.fuelRepo.find({ where: { id: In(newParams) } });
  const fuelData = fuelsSnapshot.map(f => ({
    id: f.id,
    name: f.name,
    category: f.category,
    composition: f.composition,
    inventory: f.inventory,
    modifier: f.modifier,
    enabled: f.enabled,
    remark: f.remark,
    created_at: f.created_at,
    updated_at: f.updated_at,
  }));

  // ================= 3️⃣ 合并 otherSettings，不覆盖已有字段 =================
  const newOtherSettings = _.cloneDeep(configData.otherSettings || {});
  newOtherSettings["焦丁比选择"] = '';
  newOtherSettings["煤比选择"] = '';

  const jiaoding = fuelsSnapshot.find(f => f.name.includes('焦丁'));
  if (jiaoding) newOtherSettings["焦丁比选择"] = String(jiaoding.id);

  const mei = fuelsSnapshot.find(f => f.name.includes('煤'));
  if (mei) newOtherSettings["煤比选择"] = String(mei.id);

  // ================= 4️⃣ 保存当前模块 =================
  group.config_data = {
    ...configData,
    fuelParams: newParams,
    fuelLimits: newLimits,
    fuelData,
    otherSettings: newOtherSettings,
  };
  await this.configRepo.save(group);

  // ================= 5️⃣ 跨模块同步 =================
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

    // 克隆已有 otherSettings
    const syncedOtherSettings = { ...(otherData.otherSettings || {}) };
    syncedOtherSettings["焦丁比选择"] = newOtherSettings["焦丁比选择"];
    syncedOtherSettings["煤比选择"] = newOtherSettings["煤比选择"];

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
        fuelData,
        otherSettings: syncedOtherSettings,
      };
    } else {
      otherGroup.config_data = {
        ...otherData,
        fuelParams: newParams,
        fuelLimits: newLimits,
        fuelData,
        otherSettings: syncedOtherSettings,
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
  const oldData: any[] = configData.fuelData || [];

  const newParams = oldParams.filter(id => !removeIds.includes(id));

  const newLimits: Record<string, any> = {};
  Object.keys(oldLimits).forEach(id => {
    if (!removeIds.includes(Number(id))) newLimits[id] = oldLimits[id];
  });

  // 🔹 更新燃料快照
  const newFuelData = oldData.filter(f => !removeIds.includes(f.id));

  group.config_data = {
    ...configData,
    fuelParams: newParams,
    fuelLimits: newLimits,
    fuelData: newFuelData,
    otherSettings: configData.otherSettings || {},
  };
  await this.configRepo.save(group);

  // 🔧 跨模块同步
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

    const newOtherFuelData = (otherData.fuelData || []).filter(f => !removeIds.includes(f.id));

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
        fuelData: newOtherFuelData,
        otherSettings: otherData.otherSettings || {},
      };
    } else {
      otherGroup.config_data = {
        ...otherData,
        fuelParams: newParams,
        fuelLimits: newLimits,
        fuelData: newOtherFuelData,
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
  ingredientResults?: Record<string, number>,
  fuelResults?: Record<string, number>,
) {
  const group = await this.getOrCreateUserGroup(user, moduleName);
  const existingData = _.cloneDeep(group.config_data || {});

  // ===================== otherSettings 同步白名单 =====================
  const OTHER_SETTING_WHITELIST: Record<string, string[]> = {
    '单独高炉配料计算': ['固定配比', '煤比选择', '焦丁比选择'],
    '铁前一体化配料计算I': ['固定配比', '煤比选择', '焦丁比选择', '变量选择'],
    '铁前一体化配料计算II': ['固定配比', '煤比选择', '焦丁比选择', '变量选择'],
    '利润一体化配料计算': ['固定配比', '煤比选择', '焦丁比选择', '变量选择'],
    '生铁固定配料计算': ['煤比选择', '焦丁比选择'],
  };

  // ===================== 公共同步字段 =====================
  const syncCommonData: Record<string, any> = {};
  if (ingredientLimits !== undefined) syncCommonData.ingredientLimits = ingredientLimits;
  if (fuelLimits !== undefined) syncCommonData.fuelLimits = fuelLimits;
  if (slagLimits !== undefined) syncCommonData.slagLimits = slagLimits;
  if (hotMetalRatio !== undefined) syncCommonData.hotMetalRatio = hotMetalRatio;
  if (loadTopLimits !== undefined) syncCommonData.loadTopLimits = loadTopLimits;
  if (ironWaterTopLimits !== undefined) syncCommonData.ironWaterTopLimits = ironWaterTopLimits;

  // ===================== 当前模块 otherSettings（全量保存） =====================
  const currentOtherSettings: Record<string, any> = {};
  if (otherSettings) {
    for (const key of Object.keys(otherSettings)) {
      currentOtherSettings[key] = otherSettings[key];
    }
  }

  // ===================== 当前模块保存（含结果） =====================
  group.config_data = {
    ...existingData,
    ...syncCommonData,

    // ⭐ 只有当前模块才允许写入结果
    ...(ingredientResults !== undefined ? { ingredientResults } : {}),
    ...(fuelResults !== undefined ? { fuelResults } : {}),

    otherSettings: {
      ...(existingData.otherSettings || {}),
      ...currentOtherSettings,
    },
  };

  await this.configRepo.save(group);

  // ===================== 跨模块同步（不带结果） =====================
  const allModules = Object.keys(OTHER_SETTING_WHITELIST);
  const otherModules = allModules.filter(m => m !== moduleName);

  for (const other of otherModules) {
    const otherGroup = await this.getOrCreateUserGroup(user, other);
    const otherData = _.cloneDeep(otherGroup.config_data || {});
    const targetWhitelist = OTHER_SETTING_WHITELIST[other] || [];

    // 仅同步白名单里的 otherSettings
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

    // 🚫 默认禁止跨模块同步结果
    delete newConfig.ingredientResults;
    delete newConfig.fuelResults;

    // ⭐ 生铁固定配料计算：只保留自身已有结果
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

  // 🔢 计算总费用
  const totalCost = this.calcTotalCost(map);

  // 转为列表
  let list = this.toTableArray(map);

  // 关键字过滤
  if (keyword?.trim()) {
    const kw = keyword.trim();
    list = list.filter(item => item.name.includes(kw));
  }

  // ================= 排序逻辑 =================
  const categoryOrder = ['动力费用', '制造费用', '其他']; // 固定分类顺序
  list.sort((a, b) => {
    const catA = categoryOrder.indexOf(a['项目分类']) >= 0 ? categoryOrder.indexOf(a['项目分类']) : 999;
    const catB = categoryOrder.indexOf(b['项目分类']) >= 0 ? categoryOrder.indexOf(b['项目分类']) : 999;
    if (catA !== catB) return catA - catB;
    return a.name.localeCompare(b.name);
  });

  // ================= 字段顺序固定 =================
  const formattedList = list.map(item => ({
    'name': item['name'],
    '项目分类': item['项目分类'] ?? '',
    '单位': item['单位'] ?? '',
    '价格': item['价格'] ?? '--',
    '单位用量': item['单位用量'] ?? '--',
    '单位成本': item['单位成本'] ?? '--',
  }));

  const total = formattedList.length;
  const pagedList = formattedList.slice((page - 1) * pageSize, page * pageSize);

  return {
    data: pagedList,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
    totalCost,
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

/**
 * 导出高炉工序成本为 Excel
 * @param user 当前用户
 * @returns Excel Buffer
 */
async exportGLProcessCostExcel(user: User): Promise<Buffer> {
  const group = await this.getOrCreateUserGroup(user, '单独高炉配料计算');
  const costMap: Record<string, any> = group.config_data?.GLProcessCost || {};

  const list = Object.entries(costMap).map(([name, val]) => ({
    项目: name,
    单位: val.单位 || '',
    价格: val.价格 || '',
    单位用量: val.单位用量 || '',
    单位成本: val.单位成本 || '',
  }));

  const totalCost = this.calcTotalCost(costMap);

  const excelData: any[][] = [
    ['高炉工序成本测算表'],
    ['项目', '单位', '价格', '单位用量', '单位成本'],
  ];

  list.forEach(item => {
    excelData.push([
      item.项目,
      item.单位,
      item.价格,
      item.单位用量,
      item.单位成本,
    ]);
  });

  excelData.push(['工序成本合计', '元', '', '', totalCost]);

  const worksheet = XLSX.utils.aoa_to_sheet(excelData);

  // ✅ 合并标题
  worksheet['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
  ];

  // ✅ 获取范围
  const range = XLSX.utils.decode_range(worksheet['!ref']!);

  for (let R = range.s.r; R <= range.e.r; ++R) {
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = worksheet[addr];

      if (!cell) continue;

      // 初始化 style
      if (!cell.s) cell.s = {};

      // ✅ 只要有内容就加边框
      if (cell.v !== undefined && cell.v !== '') {
        cell.s.border = {
          top: { style: 'thin' },
          bottom: { style: 'thin' },
          left: { style: 'thin' },
          right: { style: 'thin' },
        };
      }

      // ✅ 全部居中
      cell.s.alignment = {
        horizontal: 'center',
        vertical: 'center',
      };

      // ✅ 标题行
      if (R === 0) {
        cell.s.font = {
          bold: true,
          sz: 14,
        };
      }

      // ✅ 表头行
      if (R === 1) {
        cell.s.font = { bold: true };
        cell.s.fill = {
          fgColor: { rgb: 'EAEAEA' },
        };
      }
    }
  }

  // ✅ 总计行加粗
  const lastRow = excelData.length - 1;
  for (let C = range.s.c; C <= range.e.c; ++C) {
    const addr = XLSX.utils.encode_cell({ r: lastRow, c: C });
    if (worksheet[addr]) {
      worksheet[addr].s.font = { bold: true };
    }
  }

  // ✅ 列宽
  worksheet['!cols'] = [
    { wch: 20 },
    { wch: 10 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '高炉成本报表');

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
}

