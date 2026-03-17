// sjconfig.service.ts
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

import { ConfigGroup } from '../../database/entities/config-group.entity';
import { BizModule } from '../../database/entities/biz-module.entity';
import { User } from '../user/entities/user.entity';
import { SjRawMaterial } from '../sj-raw-material/entities/sj-raw-material.entity';
import { FIXED_HEADERS } from '../sj-raw-material/sj-raw-material.service';
import _ from 'lodash';
import { In } from 'typeorm';
import { BadRequestException } from '@nestjs/common/exceptions';
import { UpdateSelectedIngredientDataDto } from './dto/update-selected-ingredient-data.dto';
import * as XLSX from 'xlsx';


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
  ) { }

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
    const configData = _.cloneDeep(group.config_data || {});

    // ============================================
    // 通用排序工具
    // ============================================
    const orderObject = (
      source: Record<string, any>,
      order: string[],
    ): Record<string, any> => {
      const ordered: Record<string, any> = {};

      // 先按指定顺序放
      order.forEach(key => {
        if (key in source) {
          ordered[key] = source[key];
        }
      });

      // 再补充未定义顺序字段（防止扩展丢失）
      Object.keys(source).forEach(key => {
        if (!(key in ordered)) {
          ordered[key] = source[key];
        }
      });

      return ordered;
    };

    // ============================================
    // 1️⃣ ingredientLimits 加 name
    // ============================================
    const ingredientLimits = configData.ingredientLimits || {};
    const rawIds = Object.keys(ingredientLimits).map(id => Number(id));

    let rawMap: Record<number, any> = {};

    if (rawIds.length) {
      const raws = await this.rawRepo.findByIds(rawIds);

      raws.forEach(r => {
        rawMap[r.id] = r;
      });

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

    // ============================================
    // 2️⃣ ingredientResults 加 name（value 不变）
    // ============================================
    const ingredientResults = configData.ingredientResults || {};

    if (Object.keys(ingredientResults).length && Object.keys(rawMap).length) {
      const resultsWithName: Record<string, any> = {};

      Object.keys(ingredientResults).forEach(id => {
        const numId = Number(id);
        const raw = rawMap[numId];

        if (raw) {
          resultsWithName[id] = {
            name: raw.name,
            value: ingredientResults[id],
          };
        }
      });

      configData.ingredientResults = resultsWithName;
    }

    // ============================================
    // 3️⃣ otherSettings 固定字段顺序
    // ============================================
    const otherSettingsOrder = [
      '精粉',
      '固定配比',
      '其他费用',
      '计划上料量',
      '脱硫率',
      '烟气流量',
      '品位间距',
      '碱度间距',
      'S残存系数',
      'Pb残存系数',
      'K2O残存系数',
      'Na2O残存系数',
      '烧结矿产量',
      '原料余量设置',
      '精粉总比例上限',
      '精粉总比例下限',
      '干基总残存修正值',
      '修正值运算',
    ];

    if (configData.otherSettings) {
      configData.otherSettings = orderObject(
        configData.otherSettings,
        otherSettingsOrder,
      );
    }

    // ============================================
    // 4️⃣ chemicalLimits 固定字段顺序
    // ============================================
    const chemicalOrder = [
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

    if (configData.chemicalLimits) {
      configData.chemicalLimits = orderObject(
        configData.chemicalLimits,
        chemicalOrder,
      );
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

    const oldParams: string[] = (configData.ingredientParams || []).map(String);
    const oldLimits: Record<string, any> = _.cloneDeep(configData.ingredientLimits || {});
    const builtinPowderMap: Record<string, any> = configData.BuiltinPowder || {};

    // 确保 otherSettings 存在
    if (!configData.otherSettings) configData.otherSettings = {};
    if (!Array.isArray(configData.otherSettings['精粉']))
      configData.otherSettings['精粉'] = (configData.otherSettings['精粉'] || []).map(String);
    if (!Array.isArray(configData.otherSettings['固定配比']))
      configData.otherSettings['固定配比'] = (configData.otherSettings['固定配比'] || []).map(String);

    let newParams: string[] = [];
    const newLimits: Record<string, any> = _.cloneDeep(oldLimits);

    const isCategoryMode = (category && category.trim() !== '') || (name && name.trim() !== '');

    // ================= 分类模式 =================
    if (isCategoryMode) {
      let qb = this.rawRepo.createQueryBuilder('raw').where('raw.id IN (:...ids)', { ids: oldParams.map(Number) });
      if (category?.trim()) qb = qb.andWhere('raw.category LIKE :cat', { cat: `${category}%` });
      if (name?.trim()) qb = qb.andWhere('raw.name LIKE :name', { name: `%${name}%` });

      const categoryIdsInDB = (await qb.getMany()).map(r => String(r.id));
      const toAdd = selectedIds.map(String).filter(id => !categoryIdsInDB.includes(id));
      const toRemove = categoryIdsInDB.filter(id => !selectedIds.map(String).includes(id));

      // 删除 limits
      toRemove.forEach(id => delete newLimits[id]);

      // 新的 ingredientParams
      newParams = Array.from(new Set([...oldParams.filter(id => !toRemove.includes(id)), ...toAdd]));

      // 删除 otherSettings 中已移除的精粉和固定配比
      const keepIds = new Set(newParams);
      ['精粉', '固定配比'].forEach(key => {
        configData.otherSettings[key] = configData.otherSettings[key].filter(id => keepIds.has(id));
      });

      // 再新增精粉
      const rawsToAdd = await this.rawRepo.findByIds(toAdd.map(Number));
      rawsToAdd.forEach(raw => {
        if (!newLimits[raw.id]) {
          const builtinPowder = builtinPowderMap[raw.name];
          newLimits[raw.id] = builtinPowder
            ? { low_limit: builtinPowder.low_limit ?? 0, top_limit: builtinPowder.top_limit ?? 100, lose_index: 1 }
            : { low_limit: 0, top_limit: 100, lose_index: 1 };
        }

        if (raw.category?.startsWith('T1')) {
          const strId = String(raw.id);
          if (!configData.otherSettings['精粉'].includes(strId)) {
            configData.otherSettings['精粉'].push(strId);
          }
        }
      });
    }

    // ================= 全量模式 =================
    else {
      const selectedIdsStr = selectedIds.map(String);

      // 删除 limits
      Object.keys(newLimits).forEach(id => {
        if (!selectedIdsStr.includes(id)) delete newLimits[id];
      });

      newParams = Array.from(new Set(selectedIdsStr));

      // 删除 otherSettings 中已移除的精粉和固定配比
      const keepIds = new Set(newParams);
      ['精粉', '固定配比'].forEach(key => {
        configData.otherSettings[key] = configData.otherSettings[key].filter(id => keepIds.has(id));
      });

      // 新增精粉
      const raws = await this.rawRepo.findByIds(selectedIds);
      raws.forEach(raw => {
        if (!newLimits[raw.id]) {
          const builtinPowder = builtinPowderMap[raw.name];
          newLimits[raw.id] = builtinPowder
            ? { low_limit: builtinPowder.low_limit ?? 0, top_limit: builtinPowder.top_limit ?? 100, lose_index: 1 }
            : { low_limit: 0, top_limit: 100, lose_index: 1 };
        }

        if (raw.category?.startsWith('T1')) {
          const strId = String(raw.id);
          if (!configData.otherSettings['精粉'].includes(strId)) {
            configData.otherSettings['精粉'].push(strId);
          }
        }
      });
    }

    // ================= 生成 ingredientData =================
    const raws = await this.rawRepo.findByIds(newParams.map(Number));
    const ingredientData = raws.map(raw => ({
      id: String(raw.id),
      name: raw.name,
      category: raw.category,
      composition: raw.composition,
      inventory: raw.inventory,
      origin: raw.origin,
      modifier: raw.modifier,
      enabled: raw.enabled,
      remark: raw.remark,
      created_at: raw.created_at,
      updated_at: raw.updated_at,
    }));

    // ================= 保存当前模块 =================
    if (!group.config_data) group.config_data = {};
    group.config_data.ingredientParams = newParams;
    group.config_data.ingredientLimits = _.cloneDeep(newLimits);
    group.config_data.ingredientData = _.cloneDeep(ingredientData);
    group.config_data.otherSettings = configData.otherSettings;
    await this.configRepo.save(group);

    // ================= 同步其他模块 =================
    const syncModules = ['烧结固定配料计算', '硫平衡计算'];
    for (const syncModule of syncModules) {
      const otherGroup = await this.getOrCreateUserGroup(user, syncModule);
      if (!otherGroup.config_data) otherGroup.config_data = {};

      otherGroup.config_data.ingredientParams = newParams;
      otherGroup.config_data.ingredientLimits = _.cloneDeep(newLimits);
      otherGroup.config_data.ingredientData = _.cloneDeep(ingredientData);

      const ingredientResults: Record<string, number> = {};
      newParams.forEach(id => {
        ingredientResults[id] = newLimits[Number(id)]?.low_limit ?? 0;
      });
      otherGroup.config_data.ingredientResults = ingredientResults;

      await this.configRepo.save(otherGroup);
    }

    return group;
  }
  /** 删除选中的原料（同步更新精粉 + 固定配比） */
  /** 删除选中的原料（同步更新精粉 + 固定配比 + 其他模块） */
  async deleteIngredientParams(
    user: User,
    moduleName: string,
    removeParams: number[],
  ) {
    const group = await this.getOrCreateUserGroup(user, moduleName);
    const configData = _.cloneDeep(group.config_data || {});

    const oldParams: number[] = configData.ingredientParams || [];
    const oldLimits: Record<string, any> = configData.ingredientLimits || {};
    const oldData: any[] = configData.ingredientData || [];

    const newParams = oldParams.filter(id => !removeParams.includes(id));

    const newLimits: Record<string, any> = {};
    Object.keys(oldLimits).forEach(id => {
      if (!removeParams.includes(Number(id))) {
        newLimits[id] = oldLimits[id];
      }
    });

    const newData = oldData.filter(
      item => !removeParams.includes(item.id),
    );

    group.config_data = {
      ...configData,
      ingredientParams: newParams,
      ingredientLimits: newLimits,
      ingredientData: newData,
    };

    await this.configRepo.save(group);

    const syncModules = ['烧结固定配料计算', '硫平衡计算'];

    for (const syncModule of syncModules) {
      const otherGroup = await this.getOrCreateUserGroup(user, syncModule);
      const otherConfigData = _.cloneDeep(otherGroup.config_data || {});

      otherConfigData.ingredientParams = newParams;
      otherConfigData.ingredientLimits = newLimits;
      otherConfigData.ingredientData = newData;

      const oldResults = otherConfigData.ingredientResults || {};
      const newResults: Record<number, number> = {};

      newParams.forEach(id => {
        newResults[id] =
          oldResults[id] ??
          newLimits[id]?.low_limit ??
          0;
      });

      otherConfigData.ingredientResults = newResults;

      otherGroup.config_data = otherConfigData;
      await this.configRepo.save(otherGroup);
    }

    return group;
  }



  /** 获取已选原料（分页） */
  /** 获取已选原料（支持分页、名称模糊、分类筛选） */
  /** 规范化composition */
  private normalizeComposition(composition?: Record<string, number>): Record<string, number> {
    const result: Record<string, number> = {};
    FIXED_HEADERS.forEach((key) => {
      result[key] = composition?.[key] ?? 0;
    });
    return result;
  }

  /** 排序字段映射 */
  private readonly SORT_FIELD_MAP: Record<string, string> = {
    name: 'raw.name',
    category: 'raw.category',
    inventory: 'raw.inventory',
    'composition.TFe': "JSON_EXTRACT(raw.composition, '$.TFe')",
    'composition.SiO2': "JSON_EXTRACT(raw.composition, '$.SiO2')",
    'composition.价格': "JSON_EXTRACT(raw.composition, '$.价格')",
  };

  async getSelectedIngredients(
    user: User,
    moduleName: string,
    page = 1,
    pageSize = 10,
    name?: string,
    type?: string,
    sort?: string,
    order?: 'asc' | 'desc',
  ) {
    const group = await this.getOrCreateUserGroup(user, moduleName);
    const configData = group.config_data || {};

    let ingredientData: any[] = configData.ingredientData || [];

    // ⭐ 兼容老数据（没有 snapshot 时自动生成）
    if (!ingredientData.length && configData.ingredientParams?.length) {
      const raws = await this.rawRepo.findByIds(configData.ingredientParams);
      ingredientData = raws;
    }

    if (!ingredientData.length) {
      return { data: [], total: 0, page, pageSize, totalPages: 0 };
    }

    let list = [...ingredientData];

    if (name) {
      list = list.filter(i => i.name?.includes(name));
    }

    if (type) {
      list = list.filter(i => i.category?.includes(type));
    }

    if (sort) {
      list.sort((a, b) => {
        const valA = sort.startsWith('composition.')
          ? a.composition?.[sort.split('.')[1]] ?? 0
          : a[sort] ?? 0;

        const valB = sort.startsWith('composition.')
          ? b.composition?.[sort.split('.')[1]] ?? 0
          : b[sort] ?? 0;

        if (valA === valB) return 0;

        return order === 'desc'
          ? valB > valA ? 1 : -1
          : valA > valB ? 1 : -1;
      });
    }

    const total = list.length;
    const start = (page - 1) * pageSize;
    const pageData = list.slice(start, start + pageSize);

    return {
      data: pageData.map(item => ({
        ...item,
        composition: this.normalizeComposition(item.composition),
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /** 批量恢复已选原料数据，与原料库保持一致 */
  async restoreSelectedIngredients(
    user: User,
    moduleName: string,
    ids: number[],
  ) {
    const group = await this.getOrCreateUserGroup(user, moduleName);
    const configData = _.cloneDeep(group.config_data || {});
    const ingredientParams: number[] = configData.ingredientParams || [];

    // 如果传空数组，则恢复全部已选原料
    const restoreIds = ids.length ? ids : ingredientParams;

    if (!restoreIds.length) return group;

    // 查询原料库数据
    const raws = await this.rawRepo.findByIds(restoreIds);

    // ingredientData 可能原本是数组
    const ingredientData: any[] = configData.ingredientData || [];

    raws.forEach(raw => {
      // 查找是否已存在该 id
      const index = ingredientData.findIndex(item => item.id === raw.id);
      const newData = {
        ...raw,
        composition: this.normalizeComposition(raw.composition),
      };

      if (index >= 0) {
        ingredientData[index] = newData; // 替换
      } else {
        ingredientData.push(newData); // 添加
      }
    });

    configData.ingredientData = ingredientData;
    group.config_data = configData;
    await this.configRepo.save(group);

    return ingredientData.filter(item => restoreIds.includes(item.id));
  }
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
    const ingredientData: Record<number, any> = {};
    ingredientDataArray.forEach(item => {
      ingredientData[item.id] = item;
    });

    const existing = ingredientData[id];
    if (!existing) {
      throw new NotFoundException('原料未被选中，无法修改');
    }

    ingredientData[id] = {
      ...existing,
      name: dto.name ?? existing.name,
      category: dto.category ?? existing.category,
      origin: dto.origin ?? existing.origin,
      remark: dto.remark ?? existing.remark,
      inventory: dto.inventory ?? existing.inventory,
      composition: dto.composition
        ? this.normalizeComposition({ ...existing.composition, ...dto.composition })
        : existing.composition,
      modifier: username,
      updated_at: new Date(),
    };

    configData.ingredientData = Object.values(ingredientData);
    group.config_data = configData;
    await this.configRepo.save(group);

    return ingredientData[id];
  }
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
  // 分页获取工序成本列表
  async getSJProcessCostList(
    user: User,
    page = 1,
    pageSize = 10,
    keyword?: string,
  ) {
    const group = await this.getOrCreateUserGroup(user, '烧结配料计算');
    const costMap: Record<string, any> = group.config_data?.SJProcessCost || {};

    // ⭐ 计算总费用
    const totalCost = this.calcTotalCost(costMap);

    // 转为列表
    let list = Object.entries(costMap).map(([name, val]) => ({ name, ...val }));

    // 支持关键字过滤
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
      'name': item['name'],           // ⭐ name 放最前
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

  /**
   * 保存 固定配料 / 硫平衡 模块的
   * otherSettings + ingredientResults
   */
  async saveFixedModuleSettings(
    user: User,
    moduleName: '烧结固定配料计算' | '硫平衡计算',
    payload: {
      otherSettings?: Record<string, any>;
      ingredientResults?: Record<string, number>;
    },
  ) {
    // 1️⃣ 校验模块
    if (!['烧结固定配料计算', '硫平衡计算'].includes(moduleName)) {
      throw new BadRequestException('非法模块');
    }

    // 2️⃣ 获取配置
    const group = await this.getOrCreateUserGroup(user, moduleName);
    const configData = _.cloneDeep(group.config_data || {});

    // 3️⃣ 初始化
    if (!configData.otherSettings) configData.otherSettings = {};
    if (!configData.ingredientResults) configData.ingredientResults = {};

    // 4️⃣ ⭐ 局部更新（PUT 行为）
    if (payload.otherSettings) {
      Object.assign(configData.otherSettings, payload.otherSettings);
    }

    if (payload.ingredientResults) {
      Object.assign(configData.ingredientResults, payload.ingredientResults);
    }

    // 5️⃣ 保存
    group.config_data = configData;
    await this.configRepo.save(group);

    // 6️⃣ 返回完整参数
    return {
      success: true,
      message: `${moduleName} 参数保存成功`,
      data: {
        ...configData,
      },
    };
  }

  private getSulfurConfig(group: any) {
    if (!group.config_data) {
      group.config_data = {};
    }
    return group.config_data;
  }

  async addOtherSExp(user: User, items: any[]) {
    const group = await this.getOrCreateUserGroup(user, '硫平衡计算');
    const config = this.getSulfurConfig(group);

    config.otherSExp = config.otherSExp || {};

    items.forEach(item => {
      const { key, ...payload } = item;
      config.otherSExp[key] = payload;
    });

    group.config_data = config;
    await this.configRepo.save(group);

    return {
      success: true,
      data: config.otherSExp,
    };
  }

  async updateOtherSExp(user: User, key: string, payload: any) {
    const group = await this.getOrCreateUserGroup(user, '硫平衡计算');
    const config = this.getSulfurConfig(group);

    if (!config.otherSExp?.[key]) {
      throw new BadRequestException(`支出项 ${key} 不存在`);
    }

    config.otherSExp[key] = {
      ...config.otherSExp[key],
      ...payload,
    };

    group.config_data = config;
    await this.configRepo.save(group);

    return {
      success: true,
      data: config.otherSExp[key],
    };
  }

  async deleteOtherSExp(user: User, keys: string[]) {
    const group = await this.getOrCreateUserGroup(user, '硫平衡计算');
    const config = this.getSulfurConfig(group);

    keys.forEach(key => {
      delete config.otherSExp?.[key];
    });

    group.config_data = config;
    await this.configRepo.save(group);

    return {
      success: true,
      data: config.otherSExp,
    };
  }
  async addExtMaterial(user: User, items: any[]) {
    const group = await this.getOrCreateUserGroup(user, '硫平衡计算');
    const config = this.getSulfurConfig(group);

    config.extMaterial = config.extMaterial || {};

    items.forEach(item => {
      const { key, ...payload } = item;
      config.extMaterial[key] = payload;
    });

    group.config_data = config;
    await this.configRepo.save(group);

    return {
      success: true,
      data: config.extMaterial,
    };
  }
  async updateExtMaterial(user: User, key: string, payload: any) {
    const group = await this.getOrCreateUserGroup(user, '硫平衡计算');
    const config = this.getSulfurConfig(group);

    if (!config.extMaterial?.[key]) {
      throw new BadRequestException(`外配项 ${key} 不存在`);
    }

    config.extMaterial[key] = {
      ...config.extMaterial[key],
      ...payload,
    };

    group.config_data = config;
    await this.configRepo.save(group);

    return {
      success: true,
      data: config.extMaterial[key],
    };
  }
  async deleteExtMaterial(user: User, keys: string[]) {
    const group = await this.getOrCreateUserGroup(user, '硫平衡计算');
    const config = this.getSulfurConfig(group);

    keys.forEach(key => {
      delete config.extMaterial?.[key];
    });

    group.config_data = config;
    await this.configRepo.save(group);

    return {
      success: true,
      data: config.extMaterial,
    };
  }

  async getOtherSExpList(
    user: User,
    page = 1,
    pageSize = 10,
    keyword?: string,
  ) {
    const group = await this.getOrCreateUserGroup(user, '硫平衡计算');
    const map: Record<string, any> = group.config_data?.otherSExp || {};

    let list = Object.entries(map).map(([name, val]) => ({
      name,
      ...val,
    }));

    if (keyword?.trim()) {
      list = list.filter(item => item.name.includes(keyword.trim()));
    }

    const total = list.length;
    const data = list.slice((page - 1) * pageSize, page * pageSize);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
  async getExtMaterialList(
    user: User,
    page = 1,
    pageSize = 10,
    keyword?: string,
  ) {
    const group = await this.getOrCreateUserGroup(user, '硫平衡计算');
    const map: Record<string, any> = group.config_data?.extMaterial || {};

    let list = Object.entries(map).map(([name, val]) => ({
      name,
      ...val,
    }));

    if (keyword?.trim()) {
      list = list.filter(item => item.name.includes(keyword.trim()));
    }

    const total = list.length;
    const data = list.slice((page - 1) * pageSize, page * pageSize);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  // ============================================================
  // 🔥 内置矿粉配比（BuiltinPowder）
  // ============================================================
  // 说明：内置矿粉配比存储在 config_data.BuiltinPowder 中，用于在选择烧结矿时自动设置上下限
  // 数据结构：{ "BuiltinPowder": { "物料名称": { "name": "物料名称", "top_limit": 80, "low_limit": 0 } } }

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
    const group = await this.getOrCreateUserGroup(user, '烧结配料计算');
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
   * @throws BadRequestException 如果物料不存在或新名称已存在
   */
  async updateBuiltinPowder(
    user: User,
    key: string,
    payload: { name?: string; top_limit?: number; low_limit?: number },
  ) {
    const group = await this.getOrCreateUserGroup(user, '烧结配料计算');
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
   * @returns 返回操作结果和删除后的完整dic数据
   */
  async deleteBuiltinPowder(
    user: User,
    keys: string[],
  ) {
    const group = await this.getOrCreateUserGroup(user, '烧结配料计算');
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
    const group = await this.getOrCreateUserGroup(user, '烧结配料计算');
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
   * 根据物料名称获取内置矿粉配比（用于选择烧结矿时判断）
   * @param user 当前用户
   * @param materialName 物料名称
   * @returns 如果找到则返回上下限，否则返回null
   */
  async getBuiltinPowderByName(
    user: User,
    materialName: string,
  ): Promise<{ top_limit: number; low_limit: number } | null> {
    const group = await this.getOrCreateUserGroup(user, '烧结配料计算');
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
   * 导出烧结工序成本为 Excel
   * @param user 当前用户
   * @returns Excel Buffer
   */
  async exportSJProcessCostExcel(user: User): Promise<Buffer> {
    const group = await this.getOrCreateUserGroup(user, '烧结配料计算');
    const costMap: Record<string, any> = group.config_data?.SJProcessCost || {};
    const otherSettings = group.config_data?.otherSettings || {};

    // 转为数组格式
    const list = Object.entries(costMap).map(([name, val]) => ({
      项目: name,
      单位: val.单位 || '',
      价格: val.价格 || '',
      单位用量: val.单位用量 || '',
      单位成本: val.单位成本 || '',
    }));

    // 计算总成本
    const totalCost = this.calcTotalCost(costMap);

    // 构建 Excel 数据
    const excelData: any[][] = [
      ['烧结矿工序成本'],
      ['项目', '单位', '价格', '单位用量', '单位成本'],
    ];

    // 添加数据行
    list.forEach(item => {
      excelData.push([
        item.项目,
        item.单位,
        item.价格,
        item.单位用量,
        item.单位成本,
      ]);
    });

    // 添加总计行
    excelData.push(['工序成本合计', '元', '', '', totalCost]);

    // 创建工作簿
    const worksheet = XLSX.utils.aoa_to_sheet(excelData);
    // ✅ 合并 A1:E1
    worksheet['!merges'] = [
      {
        s: { r: 0, c: 0 },
        e: { r: 0, c: 4 },
      },
    ];

    // ✅ 关键：给 A1 设置居中
    if (worksheet['A1']) {
      worksheet['A1'].s = {
        alignment: {
          horizontal: 'center', // 水平居中
          vertical: 'center',   // 垂直居中
        },
        font: {
          bold: true, // 可选：加粗
          sz: 14,     // 可选：字号
        },
      };
    }

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '烧结矿成本报表');

    // 生成 Buffer
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

}
