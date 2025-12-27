import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import _ from 'lodash';
import { ConfigGroup } from '../../database/entities/config-group.entity';
import { BizModule } from '../../database/entities/biz-module.entity';
import { User } from '../user/entities/user.entity';
import { CoalEconInfo } from '../coal-econ-info/entities/coal-econ-info.entity';

@Injectable()
export class MixCoalConfigService {
  private readonly logger = new Logger(MixCoalConfigService.name);

  constructor(
    @InjectRepository(ConfigGroup)
    private readonly configRepo: Repository<ConfigGroup>,
    @InjectRepository(BizModule)
    private readonly moduleRepo: Repository<BizModule>,
    @InjectRepository(CoalEconInfo)
    private readonly coalRepo: Repository<CoalEconInfo>,
  ) { }

  private async getDefaultGroup(moduleName: string) {
    const module = await this.moduleRepo.findOne({ where: { name: moduleName } });
    if (!module) throw new Error(`模块 "${moduleName}" 不存在`);

    return this.configRepo.findOne({
      where: { module: { module_id: module.module_id }, is_default: true },
    });
  }

  private async getOrCreateUserGroup(user: User, moduleName: string) {
    const module = await this.moduleRepo.findOne({ where: { name: moduleName } });
    if (!module) throw new Error(`模块 "${moduleName}" 不存在`);

    let group = await this.configRepo.findOne({
      where: { user: { user_id: user.user_id }, module: { module_id: module.module_id }, is_latest: true, is_default: false },
    });

    if (!group) {
      const defaultGroup = await this.getDefaultGroup(moduleName);
      if (!defaultGroup) throw new Error(`模块 "${moduleName}" 没有默认参数组`);
      this.logger.log('用户无参数组，复制默认参数');
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

  /** 获取用户最新参数 */
  /** 获取用户最新参数，并给 coalLimits 加上 name */
async getLatestConfig(user: User, moduleName: string) {
  const group = await this.getOrCreateUserGroup(user, moduleName);
  const configData = _.cloneDeep(group.config_data);

  // 追加原料名称到 coalLimits
  const coalLimits = configData.coalLimits || {};
  const coalIds = Object.keys(coalLimits).map((id) => Number(id));

  if (coalIds.length) {
    const coals = await this.coalRepo.findByIds(coalIds); // 假设 coalRepo 可用
    const limitsWithName: Record<string, any> = {};

    coals.forEach((c) => {
      if (coalLimits[c.id]) {
        limitsWithName[c.id] = {
          name: c.name,
          ...coalLimits[c.id],
        };
      }
    });

    configData.coalLimits = limitsWithName;
  }

  return configData;
}


  /** 保存完整参数组 */
  /** 保存完整参数组（不包裹 config_data） */
  async saveFullConfig(user: User, moduleName: string, config_data: Record<string, any>) {
    const group = await this.getOrCreateUserGroup(user, moduleName);
    const oldCoalParams = group.config_data?.coalParams;
    group.config_data = _.merge({}, group.config_data || {}, config_data);

    if (oldCoalParams) { group.config_data.coalParams = oldCoalParams; } return this.configRepo.save(group);
  }


  /** 保存选中煤炭 */
  /** 保存选中混合煤（同时自动维护 coalLimits 增量） */
  /** 保存选中混合煤（自动维护 coalLimits 增量） */
  async saveSelectedCoals(user: User, moduleName: string, selectedIds: number[]) {
    const group = await this.getOrCreateUserGroup(user, moduleName);
    const configData = _.cloneDeep(group.config_data || {});

    const oldParams: number[] = configData.coalParams || [];
    const newParams: number[] = Array.from(new Set(selectedIds));

    // --- coalLimits 增量维护 ---
    const coalLimits = configData.coalLimits || {};
    for (const id of newParams) {
      if (!coalLimits[id]) {
        coalLimits[id] = { low_limit: 0, top_limit: 100 }; // 默认上下限，可按需求调整
      }
    }

    // 删除未选中煤炭对应的 coalLimits
    for (const id of Object.keys(coalLimits)) {
      if (!newParams.includes(Number(id))) {
        delete coalLimits[id];
      }
    }

    configData.coalParams = newParams;
    configData.coalLimits = coalLimits;

    group.config_data = configData;
    return this.configRepo.save(group);
  }




  /** 获取已选煤炭（分页、名称模糊） */
  async getSelectedCoals(
    user: User,
    moduleName: string,
    page = 1,
    pageSize = 10,
    name?: string,
  ) {
    page = Number(page);
    pageSize = Number(pageSize);

    const group = await this.getOrCreateUserGroup(user, moduleName);
    const configData = group.config_data || {};
    const coalParams: number[] = configData.coalParams || [];

    if (!coalParams.length) {
      return {
        data: [],
        total: 0,
        page,
        pageSize,
        totalPages: 0,
      };
    }

    let qb = this.coalRepo
      .createQueryBuilder('coal')
      .where('coal.id IN (:...ids)', { ids: coalParams });

    if (name?.trim()) {
      qb.andWhere('coal.name LIKE :name', { name: `%${name}%` });
    }

    const total = await qb.getCount();
    const records = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getMany();

    return {
      data: records,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}
