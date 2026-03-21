import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import _ from 'lodash';
import axios from 'axios';
import { ConfigGroup } from '../../database/entities/config-group.entity';
import { BizModule } from '../../database/entities/biz-module.entity';
import { User } from '../user/entities/user.entity';
import { SjEconInfo } from '../sj-econ-info/entities/sj-econ-info.entity';
import { FIXED_HEADERS } from '../sj-econ-info/sj-econ-info.service';
import { SJToggleDto } from './dto/sj-toggle.dto';


const RAW_MATERIAL_FIELD_ORDER = [
  '原料',
  'TFe',
  'SiO2',
  'CaO',
  'MgO',
  'Al2O3',
'TiO2',
  'P',
  'S',
  'Zn',
  'K2O',
  'Na2O',
  '烧损',
  '价格',
  '干配比',
];

const COKE_FIELD_ORDER = [
  'TFe',
  'SiO2',
  'CaO',
  'MgO',
  'Al2O3',
  '灰分',
  '价格',
];



@Injectable()
export class SjEconConfigService {
  private readonly logger = new Logger(SjEconConfigService.name);

  /** FastAPI 地址（可选） */
  private readonly fastApiUrl = 'http://127.0.0.1:8000/econ/start/';

  constructor(
    @InjectRepository(ConfigGroup)
    private readonly configRepo: Repository<ConfigGroup>,
    @InjectRepository(BizModule)
    private readonly moduleRepo: Repository<BizModule>,
    @InjectRepository(SjEconInfo)
    private readonly rawRepo: Repository<SjEconInfo>,
  ) {}

  /** 获取默认参数组 */
  async getDefaultGroup(moduleName: string) {
    const module = await this.moduleRepo.findOne({ where: { name: moduleName } });
    if (!module) throw new Error(`模块 "${moduleName}" 不存在`);

    return this.configRepo.findOne({
      where: { module: { module_id: module.module_id }, is_default: true },
    });
  }

  /** 获取用户最新参数组，没有则复制默认参数 */
  async getOrCreateUserGroup(user: User, moduleName: string) {
    const module = await this.moduleRepo.findOne({ where: { name: moduleName } });
    if (!module) throw new Error(`模块 "${moduleName}" 不存在`);

    let group = await this.configRepo.findOne({
      where: {
        user: { user_id: user.user_id },
        module: { module_id: module.module_id },
        is_latest: true,
        is_default: false,
      },
    });

    if (!group) {
      const defaultGroup = await this.getDefaultGroup(moduleName);
      if (!defaultGroup) throw new Error(`模块 "${moduleName}" 没有默认参数组`);

      this.logger.log(`用户无参数组，复制默认参数`);
      group = this.configRepo.create({
        user,
        module,
        config_data: _.cloneDeep(defaultGroup.config_data),
        is_latest: true,
        is_default: false,
      });
      await this.configRepo.save(group);
    }

    return group;
  }
  private sortFields(
  source: Record<string, any>,
  order: string[],
) {
  const result: Record<string, any> = {};

  // 1️⃣ 按指定顺序
  for (const key of order) {
    if (key in source) {
      result[key] = source[key];
    }
  }

  // 2️⃣ 兜底：没定义顺序的字段放后面
  for (const key of Object.keys(source)) {
    if (!(key in result)) {
      result[key] = source[key];
    }
  }

  return result;
}
private normalizeEconConfig(config: Record<string, any>) {
  const clone = _.cloneDeep(config);

  for (const block of Object.values(clone)) {
    if (!block || typeof block !== 'object') continue;

    /** ===== 原料成分设置 ===== */
    if (block['原料成分设置']) {
      const sortedRaw: Record<string, any> = {};

      for (const [name, material] of Object.entries(block['原料成分设置'])) {
        sortedRaw[name] = this.sortFields(
          material as Record<string, any>,
          RAW_MATERIAL_FIELD_ORDER,
        );
      }

      block['原料成分设置'] = sortedRaw;
    }

    /** ===== 焦炭和煤成分设置 ===== */
    if (block['焦炭和煤成分设置']) {
      const sortedCoke: Record<string, any> = {};

      for (const [name, material] of Object.entries(block['焦炭和煤成分设置'])) {
        sortedCoke[name] = this.sortFields(
          material as Record<string, any>,
          COKE_FIELD_ORDER,
        );
      }

      block['焦炭和煤成分设置'] = sortedCoke;
    }
  }

  return clone;
}

  /** 获取最新参数组 */
  async getLatestConfigByName(user: User, moduleName: string) {
  const group = await this.getOrCreateUserGroup(user, moduleName);
  const rawConfig = group.config_data || {};

  return this.normalizeEconConfig(rawConfig);
}


  /** 保存完整参数组 */
  async saveFullConfig(user: User, moduleName: string, config_data: Record<string, any>) {
    const group = await this.getOrCreateUserGroup(user, moduleName);
    group.config_data = _.merge({}, group.config_data || {}, config_data);
    return this.configRepo.save(group);
  }

  async saveSelectedIngredients(
  user: User,
  moduleName: string,
  selectedIds: number[],
  name?: string
) {
  const group = await this.getOrCreateUserGroup(user, moduleName);
  const configData = _.cloneDeep(group.config_data || {});
  const oldParams: number[] = configData.ingredientParams || [];

  let newParams: number[] = [];

  const isFilterMode = name && name.trim() !== '';

  if (isFilterMode) {
    // 模糊查找模式，增量同步
    let qb = this.rawRepo.createQueryBuilder('raw')
      .where('raw.id IN (:...ids)', { ids: oldParams });

    qb.andWhere('raw.name LIKE :name', { name: `%${name}%` });

    const filteredIds = await qb.getMany().then(r => r.map(r => r.id));

    const toRemove = filteredIds.filter(id => !selectedIds.includes(id));
    const toAdd = selectedIds.filter(id => !filteredIds.includes(id));

    newParams = oldParams.filter(id => !toRemove.includes(id));
    newParams = Array.from(new Set([...newParams, ...toAdd]));
  } else {
    // 全选模式
    newParams = Array.from(new Set(selectedIds));
  }

  configData.ingredientParams = newParams;
  group.config_data = configData;

  return await this.configRepo.save(group);
}

async deleteIngredients(
  user: User,
  moduleName: string,
  removeIds: number[]
) {
  const group = await this.getOrCreateUserGroup(user, moduleName);
  const configData = _.cloneDeep(group.config_data || {});
  const oldParams: number[] = configData.ingredientParams || [];

  configData.ingredientParams = oldParams.filter(id => !removeIds.includes(id));

  group.config_data = configData;
  return this.configRepo.save(group);
}
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
    created_at: 'raw.created_at',
    'composition.TFe': "JSON_EXTRACT(raw.composition, '$.TFe')",
    'composition.价格': "JSON_EXTRACT(raw.composition, '$.价格')",
  };

async getSelectedIngredients(
  user: User,
  moduleName: string,
  page = 1,
  pageSize = 10,
  name?: string,
  sort?: string,
  order?: 'asc' | 'desc',
) {
  const group = await this.getOrCreateUserGroup(user, moduleName);
  const configData = group.config_data || {};
  const ingredientParams: number[] = configData.ingredientParams || [];

  if (!ingredientParams.length) {
    return { data: [], total: 0, page, pageSize, totalPages: 0 };
  }

  let qb = this.rawRepo.createQueryBuilder('raw')
    .where('raw.id IN (:...ids)', { ids: ingredientParams });

  if (name?.trim()) qb.andWhere('raw.name LIKE :name', { name: `%${name}%` });

  // ⭐ 排序逻辑
  if (sort) {
    if (sort.startsWith('composition.')) {
        const key = sort.replace('composition.', '');
        qb.orderBy(
            `CAST(JSON_UNQUOTE(JSON_EXTRACT(raw.composition, '$."${key}"')) AS DECIMAL)`,
            order === 'desc' ? 'DESC' : 'ASC'
        );
    } else if (this.SORT_FIELD_MAP[sort]) {
        qb.orderBy(
            this.SORT_FIELD_MAP[sort],
            order === 'desc' ? 'DESC' : 'ASC'
        );
    } else {
        qb.orderBy('raw.id', 'ASC');
    }
} else {
    qb.orderBy('raw.id', 'ASC');
}

  const total = await qb.getCount();

  const records = await qb
    .skip((page - 1) * pageSize)
    .take(pageSize)
    .getMany();

  // ✅ 统一格式：返回composition对象，不展开
  return {
    data: records.map(item => ({
      ...item,
      composition: this.normalizeComposition(item.composition),
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

async toggleIngredient(
  user: User,
  moduleName: string,
  dto: SJToggleDto,
) {
  const { id, checked } = dto;

  const group = await this.getOrCreateUserGroup(user, moduleName);
  const configData = _.cloneDeep(group.config_data || {});

  const oldParams: number[] = configData.ingredientParams || [];
  let newParams = [...oldParams];

  // ================= 1️⃣ 切换逻辑 =================
  if (checked) {
    if (!newParams.includes(id)) {
      newParams.push(id);
    }
  } else {
    newParams = newParams.filter(i => i !== id);
  }

  // ================= 2️⃣ 保存 =================
  configData.ingredientParams = Array.from(new Set(newParams));
  group.config_data = configData;

  await this.configRepo.save(group);

  return { data: group.config_data };
}
}
