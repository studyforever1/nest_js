import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import _ from 'lodash';
import axios from 'axios';
import { ConfigGroup } from '../../database/entities/config-group.entity';
import { BizModule } from '../../database/entities/biz-module.entity';
import { User } from '../user/entities/user.entity';
import { SjEconInfo } from '../sj-econ-info/entities/sj-econ-info.entity';

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

  /** 获取最新参数组 */
  async getLatestConfigByName(user: User, moduleName: string) {
    const group = await this.getOrCreateUserGroup(user, moduleName);
    return _.cloneDeep(group.config_data);
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
async getSelectedIngredients(
  user: User,
  moduleName: string,
  page = 1,
  pageSize = 10,
  name?: string
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
