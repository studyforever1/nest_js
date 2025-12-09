import { Injectable, Logger } from '@nestjs/common';
import { Repository, In } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigGroup } from '../../database/entities/config-group.entity';
import { BizModule } from '../../database/entities/biz-module.entity';
import { User } from '../user/entities/user.entity';
import { SjRawMaterial } from '../sj-raw-material/entities/sj-raw-material.entity';
import _ from 'lodash';

// 格式化原料数据工具函数
function formatRaw(raw: SjRawMaterial) {
  const { id, category, name, origin, remark, inventory, composition } = raw;

  // composition 为空时直接返回基本字段
  if (!composition) {
    return { id, category, name, origin, remark, inventory };
  }

  const {
    TFe = null,
    H2O = null,
    烧损 = null,
    价格 = null,
    ...otherComposition
  } = composition as Record<string, any>;

  return {
    id,
    category,
    name,
    TFe,
    ...otherComposition,
    H2O,
    烧损,
    价格,
    inventory,
    origin,
    remark,
  };
}

@Injectable()
export class SjEconConfigService {
  private readonly logger = new Logger(SjEconConfigService.name);

  // 模块名称常量
  private readonly MODULE_NAME = '烧结原料经济性评价';

  constructor(
    @InjectRepository(ConfigGroup)
    private readonly configRepo: Repository<ConfigGroup>,

    @InjectRepository(BizModule)
    private readonly moduleRepo: Repository<BizModule>,

    @InjectRepository(SjRawMaterial)
    private readonly rawRepo: Repository<SjRawMaterial>,
  ) {}

  /**
   * 获取模块默认参数（必须 is_default = true）
   */
  async getDefaultGroup(moduleName: string) {
    const module = await this.moduleRepo.findOne({ where: { name: moduleName } });
    if (!module) throw new Error(`模块 "${moduleName}" 不存在`);

    return await this.configRepo.findOne({
      where: { module: { module_id: module.module_id }, is_default: true },
    });
  }

  /**
   * 获取用户最新参数，如果没有，则复制默认参数生成
   */
  async getOrCreateUserGroup(user: User, moduleName: string) {
    const module = await this.moduleRepo.findOne({ where: { name: moduleName } });
    if (!module) throw new Error(`模块 "${moduleName}" 不存在`);

    // 查询用户最新参数组（仅用户自己的组，不包含默认组）
    let group = await this.configRepo.findOne({
      where: {
        user: { user_id: user.user_id },
        module: { module_id: module.module_id },
        is_latest: true,
        is_default: false,
      },
    });

    // 用户没有 → 复制默认参数生成自己的组
    if (!group) {
      const defaultGroup = await this.getDefaultGroup(moduleName);
      if (!defaultGroup) {
        // 如果没有默认参数，创建一个空的配置组
        this.logger.log(`模块 "${moduleName}" 没有默认参数组，创建空配置组`);
        group = this.configRepo.create({
          user,
          module,
          config_data: {},
          is_latest: true,
          is_default: false,
        });
      } else {
        this.logger.log(`用户没有参数组，为用户复制默认参数组`);
        group = this.configRepo.create({
          user,
          module,
          config_data: _.cloneDeep(defaultGroup.config_data),
          is_latest: true,
          is_default: false,
        });
      }

      await this.configRepo.save(group);
    }

    return group;
  }

  /**
   * 获取完整配置（包含ingredientParams, singleBurnSet, ironCostSet）
   */
  async getFullConfig(user: User) {
    const group = await this.getOrCreateUserGroup(user, this.MODULE_NAME);
    return _.cloneDeep(group.config_data || {});
  }

  /**
   * 保存完整配置
   */
  async saveFullConfig(user: User, config: {
    ingredientParams?: Record<string, any>;
    singleBurnSet?: Record<string, any>;
    ironCostSet?: Record<string, any>;
  }) {
    const group = await this.getOrCreateUserGroup(user, this.MODULE_NAME);
    
    group.config_data = _.merge({}, group.config_data || {}, config);
    
    return await this.configRepo.save(group);
  }

  /**
   * 获取单烧测算评价法参数（singleBurnSet）
   */
  async getSingleSinteringConfig(user: User) {
    const group = await this.getOrCreateUserGroup(user, this.MODULE_NAME);
    const configData = group.config_data || {};
    return _.cloneDeep(configData.singleBurnSet || {});
  }

  /**
   * 保存单烧测算评价法参数（singleBurnSet）
   */
  async saveSingleSinteringConfig(user: User, singleBurnSet: Record<string, any>) {
    const group = await this.getOrCreateUserGroup(user, this.MODULE_NAME);
    
    if (!group.config_data) {
      group.config_data = {};
    }
    group.config_data.singleBurnSet = _.merge({}, group.config_data.singleBurnSet || {}, singleBurnSet);
    
    return await this.configRepo.save(group);
  }

  /**
   * 获取铁水成本评价法参数（ironCostSet）
   */
  async getHotMetalCostConfig(user: User) {
    const group = await this.getOrCreateUserGroup(user, this.MODULE_NAME);
    const configData = group.config_data || {};
    return _.cloneDeep(configData.ironCostSet || {});
  }

  /**
   * 保存铁水成本评价法参数（ironCostSet）
   */
  async saveHotMetalCostConfig(user: User, ironCostSet: Record<string, any>) {
    const group = await this.getOrCreateUserGroup(user, this.MODULE_NAME);
    
    if (!group.config_data) {
      group.config_data = {};
    }
    group.config_data.ironCostSet = _.merge({}, group.config_data.ironCostSet || {}, ironCostSet);
    
    return await this.configRepo.save(group);
  }

  /**
   * 更新 singleBurnSet 中的原料成分
   */
  async updateSingleBurnRawMaterial(user: User, materialKey: string, materialData: Record<string, any>) {
    const group = await this.getOrCreateUserGroup(user, this.MODULE_NAME);
    
    if (!group.config_data) {
      group.config_data = {};
    }
    if (!group.config_data.singleBurnSet) {
      group.config_data.singleBurnSet = {};
    }
    if (!group.config_data.singleBurnSet['原料成分设置']) {
      group.config_data.singleBurnSet['原料成分设置'] = {};
    }
    
    group.config_data.singleBurnSet['原料成分设置'][materialKey] = _.merge(
      {},
      group.config_data.singleBurnSet['原料成分设置'][materialKey] || {},
      materialData,
    );
    
    await this.configRepo.save(group);
    return {
      singleBurnSet: {
        原料成分设置: {
          [materialKey]: group.config_data.singleBurnSet['原料成分设置'][materialKey],
        },
      },
    };
  }

  /**
   * 更新 singleBurnSet 中的其他参数设置
   */
  async updateSingleBurnOtherSettings(user: User, otherSettings: Record<string, any>) {
    const group = await this.getOrCreateUserGroup(user, this.MODULE_NAME);
    
    if (!group.config_data) {
      group.config_data = {};
    }
    if (!group.config_data.singleBurnSet) {
      group.config_data.singleBurnSet = {};
    }
    
    group.config_data.singleBurnSet['其他参数设置'] = _.merge(
      {},
      group.config_data.singleBurnSet['其他参数设置'] || {},
      otherSettings,
    );
    
    await this.configRepo.save(group);
    return {
      singleBurnSet: {
        其他参数设置: group.config_data.singleBurnSet['其他参数设置'],
      },
    };
  }

  /**
   * 更新 ironCostSet 中的原料成分
   */
  async updateIronCostRawMaterial(user: User, materialKey: string, materialData: Record<string, any>) {
    const group = await this.getOrCreateUserGroup(user, this.MODULE_NAME);
    
    if (!group.config_data) {
      group.config_data = {};
    }
    if (!group.config_data.ironCostSet) {
      group.config_data.ironCostSet = {};
    }
    if (!group.config_data.ironCostSet['原料成分设置']) {
      group.config_data.ironCostSet['原料成分设置'] = {};
    }
    
    group.config_data.ironCostSet['原料成分设置'][materialKey] = _.merge(
      {},
      group.config_data.ironCostSet['原料成分设置'][materialKey] || {},
      materialData,
    );
    
    await this.configRepo.save(group);
    return {
      ironCostSet: {
        原料成分设置: {
          [materialKey]: group.config_data.ironCostSet['原料成分设置'][materialKey],
        },
      },
    };
  }

  /**
   * 更新 ironCostSet 中的其他参数设置
   */
  async updateIronCostOtherSettings(user: User, otherSettings: Record<string, any>) {
    const group = await this.getOrCreateUserGroup(user, this.MODULE_NAME);
    
    if (!group.config_data) {
      group.config_data = {};
    }
    if (!group.config_data.ironCostSet) {
      group.config_data.ironCostSet = {};
    }
    
    group.config_data.ironCostSet['其他参数设置'] = _.merge(
      {},
      group.config_data.ironCostSet['其他参数设置'] || {},
      otherSettings,
    );
    
    await this.configRepo.save(group);
    return {
      ironCostSet: {
        其他参数设置: group.config_data.ironCostSet['其他参数设置'],
      },
    };
  }

  /**
   * 更新 ironCostSet 中的焦炭和煤成分设置
   */
  async updateIronCostCokeCoal(user: User, cokeCoalData: Record<string, any>) {
    const group = await this.getOrCreateUserGroup(user, this.MODULE_NAME);
    
    if (!group.config_data) {
      group.config_data = {};
    }
    if (!group.config_data.ironCostSet) {
      group.config_data.ironCostSet = {};
    }
    
    group.config_data.ironCostSet['焦炭和煤成分设置'] = _.merge(
      {},
      group.config_data.ironCostSet['焦炭和煤成分设置'] || {},
      cokeCoalData,
    );
    
    await this.configRepo.save(group);
    return {
      ironCostSet: {
        焦炭和煤成分设置: group.config_data.ironCostSet['焦炭和煤成分设置'],
      },
    };
  }

  /**
   * 保存选中原料（支持全选模式 & 分类模式）
   */
  async saveSelectedIngredients(
    user: User,
    selectedIds: number[],
    category?: string,
    name?: string,
  ) {
    const group = await this.getOrCreateUserGroup(user, this.MODULE_NAME);
    const configData = _.cloneDeep(group.config_data || {});
    const oldParams: number[] = configData.ingredientParams || [];

    let newParams: number[] = [];

    // ============================================================
    // ⭐ 判断分类同步模式
    // 只要 category 或 name 任一不为空 → 分类模式
    // ============================================================
    const isCategoryMode =
      (category && category.trim() !== '') ||
      (name && name.trim() !== '');

    if (isCategoryMode) {
      // ============================================================
      // ⭐ 分类同步模式（category 有值 或 name 有值）
      // ============================================================
      let qb = this.rawRepo.createQueryBuilder('raw')
        .where('raw.id IN (:...ids)', { ids: oldParams });

      // category 条件
      if (category && category.trim()) {
        qb = qb.andWhere('raw.category LIKE :cat', { cat: `${category}%` });
      }

      // name 条件
      if (name && name.trim()) {
        qb = qb.andWhere('raw.name LIKE :name', { name: `%${name}%` });
      }

      const categoryIdsInDB = await qb.getMany().then(r => r.map(r => r.id));

      // 对比差异
      const toRemove = categoryIdsInDB.filter(id => !selectedIds.includes(id));
      const toAdd = selectedIds.filter(id => !categoryIdsInDB.includes(id));

      // 更新 ingredientParams
      newParams = Array.from(new Set([
        ...oldParams.filter(id => !toRemove.includes(id)),
        ...toAdd,
      ]));
    } else {
      // ============================================================
      // ⭐ 全选模式（category="" 且 name=""）
      // ============================================================
      newParams = Array.from(new Set(selectedIds));
    }

    // 保存最终数据
    group.config_data = {
      ...configData,
      ingredientParams: newParams,
    };

    const saved = await this.configRepo.save(group);
    return {
      ingredientParams: saved.config_data?.ingredientParams || [],
    };
  }

  /**
   * 删除选中的原料
   */
  async deleteIngredientParams(user: User, removeParams: number[]) {
    const group = await this.getOrCreateUserGroup(user, this.MODULE_NAME);
    const configData = _.cloneDeep(group.config_data || {});
    const oldParams: number[] = configData.ingredientParams || [];

    // 过滤掉删除的原料
    const newParams = oldParams.filter((id) => !removeParams.includes(id));

    group.config_data = {
      ...configData,
      ingredientParams: newParams,
    };

    const saved = await this.configRepo.save(group);
    return {
      ingredientParams: saved.config_data?.ingredientParams || [],
    };
  }

  /**
   * 获取已选原料（支持分页、名称模糊、分类筛选）
   */
  async getSelectedIngredients(
    user: User,
    page = 1,
    pageSize = 10,
    name?: string,
    type?: string,
  ) {
    const group = await this.getOrCreateUserGroup(user, this.MODULE_NAME);
    const configData = group.config_data || {};
    const ingredientParams: Record<string, any> = configData.ingredientParams || {};
    
    // ingredientParams 可能是对象（key为原料ID，value为原料数据），需要转换为数组
    const ingredientIds = typeof ingredientParams === 'object' && !Array.isArray(ingredientParams)
      ? Object.keys(ingredientParams).map(id => Number(id))
      : Array.isArray(ingredientParams)
      ? ingredientParams
      : [];

    if (!ingredientIds.length) {
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
      .where('raw.id IN (:...ids)', { ids: ingredientIds })
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
}

