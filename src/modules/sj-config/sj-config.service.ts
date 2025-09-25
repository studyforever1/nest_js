// modules/sjconfig/sjconfig.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ConfigGroup } from '../../database/entities/config-group.entity';
import { BizModule } from '../../database/entities/biz-module.entity';
import { User } from '../user/entities/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { SjRawMaterial } from '../sj-raw-material/entities/sj-raw-material.entity';
import _ from 'lodash'; // npm install lodash


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

  /** 获取最新参数组 */
  /** 获取最新参数组，并附带原料名称到 ingredientLimits */
async getLatestConfigByName(user: User, moduleName: string) {
  try {
    this.logger.log(
      `获取最新参数组，userId=${user.user_id}, moduleName=${moduleName}`,
    );

    const module = await this.moduleRepo.findOne({ where: { name: moduleName } });
    if (!module) {
      this.logger.warn(`模块 "${moduleName}" 不存在`);
      throw new Error(`模块 "${moduleName}" 不存在`);
    }

    const group = await this.configRepo.findOne({
      where: {
        user: { user_id: user.user_id },
        module: { module_id: module.module_id },
        is_latest: true,
      },
    });

    if (!group) {
      this.logger.log('未找到参数组');
      return null;
    }

    const configData = { ...(group.config_data as any) };

    // 如果有 ingredientLimits，就附带原料名称
    const ingredientLimits: Record<string, any> = configData.ingredientLimits || {};
    if (Object.keys(ingredientLimits).length) {
      // 查原料名称
      const rawIds = Object.keys(ingredientLimits).map((id) => Number(id));
      const raws = await this.rawRepo.findByIds(rawIds);

      const limitsWithName: Record<string, any> = {};
      raws.forEach((r) => {
        if (ingredientLimits[r.id]) {
          limitsWithName[r.id] = { name: r.name, ...ingredientLimits[r.id] };
        }
      });

      configData.ingredientLimits = limitsWithName;
    }

    return configData;
  } catch (error) {
    this.logger.error('getLatestConfigByName 出错', error.stack);
    throw error;
  }
}

  /** 保存完整参数组（原料/化学/其他） */
  /** 保存完整参数组，支持深合并更新 */
  async saveFullConfig(
    user: User,
    moduleName: string,
    ingredientLimits?: Record<string, any>,
    chemicalLimits?: Record<string, any>,
    otherSettings?: Record<string, any>,
  ) {
    this.logger.log(`保存完整参数组，userId=${user.user_id}, moduleName=${moduleName}`);

    const module = await this.moduleRepo.findOne({ where: { name: moduleName } });
    if (!module) throw new Error(`模块 "${moduleName}" 不存在`);

    let group = await this.configRepo.findOne({
      where: { user: { user_id: user.user_id }, module: { module_id: module.module_id }, is_latest: true },
    });

    if (!group) {
      this.logger.log('未找到最新参数组，创建默认参数组');
      group = this.configRepo.create({ user, module, config_data: {}, is_latest: true, is_shared: false });
    }

    const currentData = group.config_data || {};

    // 深合并更新
    const newData = _.merge({}, currentData, {
      ...(ingredientLimits ? { ingredientLimits } : {}),
      ...(chemicalLimits ? { chemicalLimits } : {}),
      ...(otherSettings ? { otherSettings } : {}),
    });

    group.config_data = newData;
    const savedGroup = await this.configRepo.save(group);
    this.logger.log('参数组保存成功（深合并更新）');
    return savedGroup;
  }
  /** 单独保存选中原料列表（ingredientParams）并保持 ingredientLimits 一致 */
  async saveIngredientParams(
    user: User,
    moduleName: string,
    ingredientParams: number[],
  ) {
    try {
      this.logger.log(
        `保存 ingredientParams，userId=${user.user_id}, moduleName=${moduleName}, params=${JSON.stringify(ingredientParams)}`,
      );

      // 查询模块
      const module = await this.moduleRepo.findOne({
        where: { name: moduleName },
      });
      if (!module) throw new Error(`模块 "${moduleName}" 不存在`);

      // 查询最新参数组
      let group = await this.configRepo.findOne({
        where: {
          user: { user_id: user.user_id },
          module: { module_id: module.module_id },
          is_latest: true,
        },
      });

      if (!group) {
        this.logger.log('未找到最新参数组，创建默认参数组');
        group = this.configRepo.create({
          user,
          module,
          config_data: { ingredientParams: [], ingredientLimits: {} },
          is_latest: true,
          is_shared: false,
        });
      }

      // 保留原有 config_data
      const configData = { ...(group.config_data as any) };

      // 原有 ingredientLimits
      const oldLimits: Record<string, any> = configData.ingredientLimits || {};

      // 构建新的 ingredientLimits，保持和 ingredientParams 一致
      const newLimits: Record<string, any> = {};
      ingredientParams.forEach((idx) => {
        if (oldLimits[idx]) {
          newLimits[idx] = oldLimits[idx]; // 保留已有限值
        } else {
          // 新增序号，添加默认限值
          newLimits[idx] = { low_limit: 0, top_limit: 100, lose_index: 1 };
        }
      });

      // 更新 config_data
      group.config_data = {
        ...configData,
        ingredientParams,
        ingredientLimits: newLimits,
      };

      const savedGroup = await this.configRepo.save(group);
      this.logger.log('ingredientParams 保存成功，ingredientLimits 已同步');
      return savedGroup;
    } catch (error) {
      this.logger.error('saveIngredientParams 出错', error.stack);
      throw error;
    }
  }

    /** 删除选中的原料（同步删除 ingredientParams 和 ingredientLimits） */
async deleteIngredientParams(
  user: User,
  moduleName: string,
  removeParams: number[],
) {
  this.logger.log(
    `删除 ingredientParams，userId=${user.user_id}, moduleName=${moduleName}, remove=${JSON.stringify(removeParams)}`,
  );

  const module = await this.moduleRepo.findOne({ where: { name: moduleName } });
  if (!module) throw new Error(`模块 "${moduleName}" 不存在`);

  let group = await this.configRepo.findOne({
    where: {
      user: { user_id: user.user_id },
      module: { module_id: module.module_id },
      is_latest: true,
    },
  });

  if (!group) {
    this.logger.warn('未找到参数组，无法删除');
    return null;
  }

  const configData = { ...(group.config_data as any) };
  const oldParams: number[] = configData.ingredientParams || [];
  const oldLimits: Record<string, any> = configData.ingredientLimits || {};

  // 过滤掉 removeParams
  const newParams = oldParams.filter((p) => !removeParams.includes(p));
  const newLimits: Record<string, any> = {};
  Object.keys(oldLimits).forEach((key) => {
    if (!removeParams.includes(Number(key))) {
      newLimits[key] = oldLimits[key];
    }
  });

  group.config_data = {
    ...configData,
    ingredientParams: newParams,
    ingredientLimits: newLimits,
  };

  const savedGroup = await this.configRepo.save(group);
  this.logger.log('删除原料成功');
  return savedGroup;
}

/** 获取已选中原料详情（分页，格式化输出） */
/** 获取已选中原料详情（分页，格式化输出） */
async getSelectedIngredients(
  user: User,
  moduleName: string,
  page = 1,
  pageSize = 10,
) {
  this.logger.log(
    `获取已选中原料详情，userId=${user.user_id}, moduleName=${moduleName}, page=${page}, pageSize=${pageSize}`,
  );

  const module = await this.moduleRepo.findOne({ where: { name: moduleName } });
  if (!module) throw new Error(`模块 "${moduleName}" 不存在`);

  const group = await this.configRepo.findOne({
    where: {
      user: { user_id: user.user_id },
      module: { module_id: module.module_id },
      is_latest: true,
    },
  });

  if (!group) return { total: 0, page, pageSize, list: [] };

  const configData = group.config_data as any;
  const ingredientParams: number[] = configData.ingredientParams || [];
  if (!ingredientParams.length) return { total: 0, page, pageSize, list: [] };

  // 分页
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const ids = ingredientParams.slice(start, end);

  // 获取原料详细信息
  const raws = await this.rawRepo.findByIds(ids);

  // 格式化数据
  const list = raws.map((raw) => {
    const { id, name, category, origin, composition } = raw;
    const { TFe, 价格, H2O, 烧损, ...otherComposition } = composition || {};
    return {
      id,
      name,       // ✅ 原料名称
      category,
      origin,
      TFe: TFe ?? null,
      ...otherComposition,
      H2O: H2O ?? null,
      烧损: 烧损 ?? null,
      价格: 价格 ?? null,
    };
  });

  return {
    total: ingredientParams.length,
    page,
    pageSize,
    list,
  };
}

}
