import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import _ from 'lodash';

import { ConfigGroup } from '../../database/entities/config-group.entity';
import { BizModule } from '../../database/entities/biz-module.entity';
import { User } from '../user/entities/user.entity';
import { CokeEconInfo } from '../coke-econ-info/entities/coke-econ-info.entity';

@Injectable()
export class CokeEconConfigService {
  private readonly logger = new Logger(CokeEconConfigService.name);

  constructor(
    @InjectRepository(ConfigGroup)
    private readonly configRepo: Repository<ConfigGroup>,
    @InjectRepository(BizModule)
    private readonly moduleRepo: Repository<BizModule>,
    @InjectRepository(CokeEconInfo)
    private readonly cokeRepo: Repository<CokeEconInfo>,
  ) {}

  /** 获取默认参数组 */
  async getDefaultGroup(moduleName: string) {
    const module = await this.moduleRepo.findOne({
      where: { name: moduleName },
    });
    if (!module) throw new Error(`模块 "${moduleName}" 不存在`);

    return this.configRepo.findOne({
      where: {
        module: { module_id: module.module_id },
        is_default: true,
      },
    });
  }

  /** 获取或创建用户参数组 */
  async getOrCreateUserGroup(user: User, moduleName: string) {
    const module = await this.moduleRepo.findOne({
      where: { name: moduleName },
    });
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
      if (!defaultGroup) {
        throw new Error(`模块 "${moduleName}" 没有默认参数组`);
      }

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

  /** 获取最新参数 */
  async getLatestConfigByName(user: User, moduleName: string) {
    const group = await this.getOrCreateUserGroup(user, moduleName);
    return _.cloneDeep(group.config_data);
  }

  /** 保存完整参数 */
  /** 保存完整参数（保护 cokeParams） */
async saveFullConfig(
  user: User,
  moduleName: string,
  config_data: Record<string, any>,
) {
  const group = await this.getOrCreateUserGroup(user, moduleName);

  // 保留原来的 cokeParams
  const oldCokeParams = group.config_data?.cokeParams;

  // 合并其他配置
  group.config_data = _.merge({}, group.config_data || {}, config_data);

  // 恢复 cokeParams
  if (oldCokeParams) {
    group.config_data.cokeParams = oldCokeParams;
  }

  return this.configRepo.save(group);
}


  /** 保存选中焦炭（cokeParams） */
  async saveSelectedCoke(
    user: User,
    moduleName: string,
    selectedIds: number[],
    name?: string,
  ) {
    const group = await this.getOrCreateUserGroup(user, moduleName);
    const configData = _.cloneDeep(group.config_data || {});
    const oldParams: number[] = configData.cokeParams || [];

    let newParams: number[] = [];
    const isFilterMode = !!name?.trim();

    if (isFilterMode) {
      const qb = this.cokeRepo
        .createQueryBuilder('coke')
        .where('coke.id IN (:...ids)', { ids: oldParams })
        .andWhere('coke.name LIKE :name', { name: `%${name}%` });

      const filteredIds = (await qb.getMany()).map(i => i.id);

      const toRemove = filteredIds.filter(id => !selectedIds.includes(id));
      const toAdd = selectedIds.filter(id => !filteredIds.includes(id));

      newParams = oldParams.filter(id => !toRemove.includes(id));
      newParams = Array.from(new Set([...newParams, ...toAdd]));
    } else {
      newParams = Array.from(new Set(selectedIds));
    }

    configData.cokeParams = newParams;
    group.config_data = configData;

    return this.configRepo.save(group);
  }

  /** 删除焦炭 */
  async deleteCokeParams(
    user: User,
    moduleName: string,
    removeIds: number[],
  ) {
    const group = await this.getOrCreateUserGroup(user, moduleName);
    const configData = _.cloneDeep(group.config_data || {});
    const oldParams: number[] = configData.cokeParams || [];

    configData.cokeParams = oldParams.filter(id => !removeIds.includes(id));
    group.config_data = configData;

    return this.configRepo.save(group);
  }

  /** 获取已选焦炭 */
  async getSelectedCoke(
    user: User,
    moduleName: string,
    page = 1,
    pageSize = 10,
    name?: string,
  ) {
    const group = await this.getOrCreateUserGroup(user, moduleName);
    const configData = group.config_data || {};
    const cokeParams: number[] = configData.cokeParams || [];

    if (!cokeParams.length) {
      return { data: [], total: 0, page, pageSize, totalPages: 0 };
    }

    let qb = this.cokeRepo
      .createQueryBuilder('coke')
      .where('coke.id IN (:...ids)', { ids: cokeParams });

    if (name?.trim()) {
      qb.andWhere('coke.name LIKE :name', { name: `%${name}%` });
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
